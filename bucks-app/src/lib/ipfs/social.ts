import { v7 as uuidv7 } from "uuid";
import type { Identity } from "$lib/crypto/identity";
import { signContent, verifyContent, type Signed } from "$lib/crypto/signing";
import { getBucksDB } from "./orbitdb";

export type SignedPost = {
  id: string;
  author: string;
  content: string;
  file?: { cid: string; type: string; name: string };
  visibility: "public" | "followers";
  timestamp: number;
  signature: string;
};

export type UserProfile = {
  did: string;
  name: string;
  bio: string;
  avatar?: string;
  banner?: string;
  updated_at: number;
};

export type Comment = {
  id: string;
  author: string;
  text: string;
  timestamp: number;
};

type InteractionState = {
  likes: string[];
  dislikes: string[];
  comments: Comment[];
};

type EventsDB = {
  add: (value: unknown) => Promise<unknown>;
  all: () => Promise<Array<{ value: unknown }>>;
};

type KeyValueDB = {
  get: (key: string) => Promise<unknown>;
  put: (key: string, value: unknown) => Promise<unknown>;
};

function asEventsDB(db: unknown): EventsDB {
  return db as EventsDB;
}

function asKeyValueDB(db: unknown): KeyValueDB {
  return db as KeyValueDB;
}

function parseJson<T>(value: unknown): T | null {
  if (typeof value !== "string") {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function isSignedPost(value: unknown): value is SignedPost {
  if (value == null || typeof value !== "object") {
    return false;
  }

  const post = value as Partial<SignedPost>;
  return (
    typeof post.id === "string" &&
    typeof post.author === "string" &&
    typeof post.content === "string" &&
    (post.visibility === "public" || post.visibility === "followers") &&
    typeof post.timestamp === "number" &&
    typeof post.signature === "string"
  );
}

function normalizeInteraction(value: unknown): InteractionState {
  if (value == null || typeof value !== "object") {
    return { likes: [], dislikes: [], comments: [] };
  }

  const interaction = value as Partial<InteractionState>;
  return {
    likes: Array.isArray(interaction.likes)
      ? interaction.likes.filter((x): x is string => typeof x === "string")
      : [],
    dislikes: Array.isArray(interaction.dislikes)
      ? interaction.dislikes.filter((x): x is string => typeof x === "string")
      : [],
    comments: Array.isArray(interaction.comments)
      ? interaction.comments.filter((comment): comment is Comment => {
          if (comment == null || typeof comment !== "object") {
            return false;
          }
          const c = comment as Partial<Comment>;
          return (
            typeof c.id === "string" &&
            typeof c.author === "string" &&
            typeof c.text === "string" &&
            typeof c.timestamp === "number"
          );
        })
      : [],
  };
}

export async function publishPost(params: {
  content: string;
  file?: { cid: string; type: string; name: string };
  visibility: "public" | "followers";
  identity: Identity;
}): Promise<SignedPost> {
  const db = await getBucksDB(params.identity);
  const posts = asEventsDB(db.posts);

  const payload = {
    content: params.content,
    file: params.file,
    visibility: params.visibility,
    timestamp: Date.now(),
  };

  const signed = (await signContent(payload, params.identity)) as SignedPost;
  await posts.add(JSON.stringify(signed));
  return signed;
}

export async function getFeed(limit = 50): Promise<SignedPost[]> {
  const db = await getBucksDB();
  const postsDb = asEventsDB(db.posts);
  const events = await postsDb.all();

  const parsed: SignedPost[] = [];
  for (const event of events) {
    const candidate = parseJson<SignedPost>(event.value);
    if (!candidate || !isSignedPost(candidate)) {
      continue;
    }

    const valid = await verifyContent(candidate as Signed<Record<string, unknown>>);
    if (valid) {
      parsed.push(candidate);
    }
  }

  parsed.sort((a, b) => a.id.localeCompare(b.id));
  return parsed.slice(Math.max(0, parsed.length - Math.max(1, limit)));
}

export async function toggleLike(
  postId: string,
  identity: Identity
): Promise<void> {
  const db = await getBucksDB(identity);
  const interactions = asKeyValueDB(db.interactions);

  const current = normalizeInteraction(await interactions.get(postId));
  const did = identity.did;
  const likeIndex = current.likes.indexOf(did);

  if (likeIndex >= 0) {
    current.likes.splice(likeIndex, 1);
  } else {
    current.likes.push(did);
    current.dislikes = current.dislikes.filter((entry) => entry !== did);
  }

  await interactions.put(postId, current);
}

export async function addComment(
  postId: string,
  text: string,
  identity: Identity
): Promise<void> {
  const db = await getBucksDB(identity);
  const interactions = asKeyValueDB(db.interactions);

  const current = normalizeInteraction(await interactions.get(postId));
  current.comments.push({
    id: uuidv7(),
    author: identity.did,
    text,
    timestamp: Date.now(),
  });

  await interactions.put(postId, current);
}

export async function followPeer(
  peerDID: string,
  identity: Identity
): Promise<void> {
  const db = await getBucksDB(identity);
  const following = asKeyValueDB(db.following);

  const existing = await following.get(identity.did);
  const list = Array.isArray(existing)
    ? existing.filter((x): x is string => typeof x === "string")
    : [];

  if (!list.includes(peerDID)) {
    list.push(peerDID);
    await following.put(identity.did, list);
  }
}

export async function updateProfile(
  profile: Partial<UserProfile>,
  identity: Identity
): Promise<void> {
  const db = await getBucksDB(identity);
  const users = asKeyValueDB(db.users);

  const existingRaw = await users.get(identity.did);
  let existingProfile: UserProfile = {
    did: identity.did,
    name: "",
    bio: "",
    updated_at: 0,
  };

  if (typeof existingRaw === "string") {
    const parsed = parseJson<Signed<UserProfile>>(existingRaw);
    if (parsed && (await verifyContent(parsed))) {
      existingProfile = {
        did: parsed.did,
        name: parsed.name,
        bio: parsed.bio,
        avatar: parsed.avatar,
        banner: parsed.banner,
        updated_at: parsed.updated_at,
      };
    }
  }

  const merged: UserProfile = {
    ...existingProfile,
    ...profile,
    did: identity.did,
    updated_at: Date.now(),
  };

  const signed = await signContent(merged, identity);
  await users.put(identity.did, JSON.stringify(signed));
}

export async function getFeedByFollowing(
  identity: Identity,
  limit = 50
): Promise<SignedPost[]> {
  const db = await getBucksDB(identity);
  const followingDb = asKeyValueDB(db.following);
  const postsDb = asEventsDB(db.posts);

  const rawFollowing = await followingDb.get(identity.did);
  const followedDIDs: string[] = Array.isArray(rawFollowing)
    ? rawFollowing.filter((x): x is string => typeof x === "string")
    : [];

  if (followedDIDs.length === 0) return [];

  const events = await postsDb.all();
  const parsed: SignedPost[] = [];

  for (const event of events) {
    const candidate = parseJson<SignedPost>(event.value);
    if (!candidate || !isSignedPost(candidate)) continue;
    if (!followedDIDs.includes(candidate.author)) continue;
    const valid = await verifyContent(candidate as Signed<Record<string, unknown>>);
    if (valid) parsed.push(candidate);
  }

  parsed.sort((a, b) => b.id.localeCompare(a.id));
  return parsed.slice(0, limit);
}

export async function getPopularFeed(limit = 50): Promise<SignedPost[]> {
  const db = await getBucksDB();
  const postsDb = asEventsDB(db.posts);
  const interactionsDb = asKeyValueDB(db.interactions);

  const events = await postsDb.all();
  const parsed: SignedPost[] = [];

  for (const event of events) {
    const candidate = parseJson<SignedPost>(event.value);
    if (!candidate || !isSignedPost(candidate)) continue;
    const valid = await verifyContent(candidate as Signed<Record<string, unknown>>);
    if (valid) parsed.push(candidate);
  }

  // Fetch like counts for all posts in parallel
  const likeCounts = await Promise.all(
    parsed.map(async (post) => {
      const raw = await interactionsDb.get(post.id);
      const interaction = normalizeInteraction(raw);
      return interaction.likes.length;
    })
  );

  // Sort by likes DESC, then by UUIDv7 DESC for tie-breaking
  const withCounts = parsed.map((post, i) => ({ post, likes: likeCounts[i] }));
  withCounts.sort((a, b) => b.likes - a.likes || b.post.id.localeCompare(a.post.id));

  return withCounts.slice(0, limit).map((x) => x.post);
}

export async function getProfile(did: string): Promise<UserProfile | null> {
  const db = await getBucksDB();
  const users = asKeyValueDB(db.users);

  const raw = await users.get(did);
  if (typeof raw !== "string") {
    return null;
  }

  const parsed = parseJson<Signed<UserProfile>>(raw);
  if (!parsed) {
    return null;
  }

  const valid = await verifyContent(parsed);
  if (!valid) {
    return null;
  }

  return {
    did: parsed.did,
    name: parsed.name,
    bio: parsed.bio,
    avatar: parsed.avatar,
    banner: parsed.banner,
    updated_at: parsed.updated_at,
  };
}
