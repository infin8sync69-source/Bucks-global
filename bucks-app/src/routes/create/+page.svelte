<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { unixfs } from "@helia/unixfs";
  import { getHeliaNode } from "$lib/ipfs/node";
  import { publishPost } from "$lib/ipfs/social";
  import { identityStore } from "$lib/stores/identity";

  type Visibility = "public" | "followers";
  type PreviewKind = "image" | "video" | "file" | null;

  let step = $state<1 | 2>(1);
  let dragging = $state(false);
  let selectedFile = $state<File | null>(null);
  let previewUrl = $state<string | null>(null);
  let previewKind = $state<PreviewKind>(null);
  let textOnlyDraft = $state("");

  let caption = $state("");
  let visibility = $state<Visibility>("public");
  let tagsInput = $state("");

  let publishing = $state(false);
  let publishMessage = $state("");
  let publishError = $state("");
  let publishedCid = $state("");
  let publishedPostId = $state("");

  let toast = $state("");
  let toastTimer: ReturnType<typeof setTimeout> | null = null;

  function showToast(message: string): void {
    toast = message;
    if (toastTimer) {
      clearTimeout(toastTimer);
    }
    toastTimer = setTimeout(() => {
      toast = "";
      toastTimer = null;
    }, 3000);
  }

  function acceptedFile(file: File): boolean {
    if (file.type.startsWith("image/") || file.type.startsWith("video/")) {
      return true;
    }
    const name = file.name.toLowerCase();
    return name.endsWith(".pdf") || name.endsWith(".txt") || name.endsWith(".md");
  }

  function revokePreview(): void {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
  }

  function assignFile(file: File | null): void {
    revokePreview();
    selectedFile = null;
    previewKind = null;
    previewUrl = null;

    if (!file) {
      return;
    }
    if (!acceptedFile(file)) {
      showToast("Unsupported file type. Use image, video, PDF, TXT, or MD.");
      return;
    }

    selectedFile = file;
    if (file.type.startsWith("image/")) {
      previewKind = "image";
      previewUrl = URL.createObjectURL(file);
    } else if (file.type.startsWith("video/")) {
      previewKind = "video";
      previewUrl = URL.createObjectURL(file);
    } else {
      previewKind = "file";
    }
  }

  function onFileChange(event: Event): void {
    const input = event.currentTarget as HTMLInputElement;
    assignFile(input.files?.[0] ?? null);
  }

  function onDrop(event: DragEvent): void {
    event.preventDefault();
    dragging = false;
    assignFile(event.dataTransfer?.files?.[0] ?? null);
  }

  function moveToStep2(): void {
    if (!caption.trim() && textOnlyDraft.trim()) {
      caption = textOnlyDraft.trim();
    }
    step = 2;
  }

  function tags(): string[] {
    return tagsInput
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
  }

  async function copyCid(): Promise<void> {
    if (!publishedCid) return;
    try {
      await navigator.clipboard.writeText(publishedCid);
      showToast("CID copied");
    } catch {
      showToast("Could not copy CID");
    }
  }

  async function publish(): Promise<void> {
    if (publishing) return;
    if (!caption.trim()) {
      showToast("Caption/content is required.");
      return;
    }
    if ($identityStore.status !== "unlocked" || !$identityStore.identity) {
      goto("/login");
      return;
    }

    publishing = true;
    publishError = "";
    publishMessage = "Uploading to IPFS...";
    publishedCid = "";
    publishedPostId = "";

    try {
      let fileMeta: { cid: string; type: string; name: string } | undefined;
      if (selectedFile) {
        const fileBytes = new Uint8Array(await selectedFile.arrayBuffer());
        const helia = await getHeliaNode();
        const fs = unixfs(helia.helia);
        const cid = await fs.addBytes(fileBytes);
        fileMeta = {
          cid: cid.toString(),
          type: selectedFile.type || "application/octet-stream",
          name: selectedFile.name,
        };
        publishedCid = fileMeta.cid;
      }

      const tagList = tags();
      const contentWithTags =
        tagList.length > 0
          ? `${caption.trim()}\n\n${tagList.map((tag) => `#${tag.replace(/\s+/g, "")}`).join(" ")}`
          : caption.trim();

      const post = await publishPost({
        content: contentWithTags,
        file: fileMeta,
        visibility,
        identity: $identityStore.identity,
      });

      publishedPostId = post.id;
      if (!publishedCid && fileMeta?.cid) {
        publishedCid = fileMeta.cid;
      }
      publishMessage = publishedCid
        ? `Published! CID: ${publishedCid}`
        : "Published!";
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to publish post";
      publishError = message;
      showToast(message);
    } finally {
      publishing = false;
    }
  }

  onMount(async () => {
    await identityStore.loadInitialState();
    if ($identityStore.status !== "unlocked" || !$identityStore.identity) {
      goto("/login");
    }
  });

  onDestroy(() => {
    revokePreview();
    if (toastTimer) {
      clearTimeout(toastTimer);
    }
  });
</script>

<main class="create-shell">
  <header class="create-header">
    <h1>Create Post</h1>
    <p>Publish media or text to the Bucks swarm.</p>
  </header>

  {#if step === 1}
    <section class="card">
      <h2>Step 1 — Content Selection</h2>

      <div
        class="dropzone {dragging ? 'dragging' : ''}"
        role="button"
        tabindex="0"
        ondragover={(e) => {
          e.preventDefault();
          dragging = true;
        }}
        ondragleave={() => (dragging = false)}
        ondrop={onDrop}
        onkeydown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            const picker = document.getElementById("create-file-input") as
              | HTMLInputElement
              | null;
            picker?.click();
          }
        }}
      >
        <p>Drag & drop file here</p>
        <p class="subtle">Images, videos, PDF, TXT, MD</p>

        <label class="browse-btn">
          Browse Files
          <input
            id="create-file-input"
            type="file"
            accept="image/*,video/*,.pdf,.txt,.md"
            onchange={onFileChange}
          />
        </label>
      </div>

      {#if selectedFile}
        <div class="preview-card">
          {#if previewKind === "image" && previewUrl}
            <img src={previewUrl} alt="Selected file preview" />
          {:else if previewKind === "video" && previewUrl}
            <!-- svelte-ignore a11y_media_has_caption -->
            <video src={previewUrl} controls></video>
          {:else}
            <div class="file-fallback">
              <div class="file-icon">📄</div>
              <div class="file-meta">
                <strong>{selectedFile.name}</strong>
                <span>{selectedFile.type || "Unknown type"}</span>
              </div>
            </div>
          {/if}
        </div>
      {/if}

      <div class="text-only">
        <h3>Text-only post</h3>
        <textarea
          placeholder="Write a text-only post..."
          bind:value={textOnlyDraft}
          rows={5}
        ></textarea>
      </div>

      <div class="actions">
        <button
          class="next-btn"
          disabled={!selectedFile && !textOnlyDraft.trim()}
          onclick={moveToStep2}
        >
          Continue to Compose
        </button>
      </div>
    </section>
  {:else}
    <section class="card">
      <h2>Step 2 — Compose & Publish</h2>

      <div class="compose-grid">
        <div class="left-preview">
          {#if selectedFile}
            {#if previewKind === "image" && previewUrl}
              <img src={previewUrl} alt="File preview" />
            {:else if previewKind === "video" && previewUrl}
              <!-- svelte-ignore a11y_media_has_caption -->
              <video src={previewUrl} controls></video>
            {:else}
              <div class="file-fallback full">
                <div class="file-icon">📄</div>
                <div class="file-meta">
                  <strong>{selectedFile.name}</strong>
                  <span>{selectedFile.type || "Unknown type"}</span>
                </div>
              </div>
            {/if}
          {:else}
            <div class="text-placeholder">
              <p>Text-only post</p>
              <small>No media selected</small>
            </div>
          {/if}
        </div>

        <div class="right-form">
          <label>
            Caption / Content
            <textarea
              bind:value={caption}
              rows={7}
              required
              placeholder="Write your caption..."
            ></textarea>
          </label>

          <div class="visibility-toggle">
            <button
              class:active={visibility === "public"}
              onclick={() => (visibility = "public")}
              type="button"
            >
              🌐 Public
            </button>
            <button
              class:active={visibility === "followers"}
              onclick={() => (visibility = "followers")}
              type="button"
            >
              🔒 Followers only
            </button>
          </div>

          <label>
            Tags (comma-separated)
            <input
              type="text"
              bind:value={tagsInput}
              placeholder="ipfs, tauri, bucks"
            />
          </label>

          {#if tags().length > 0}
            <div class="tag-pills">
              {#each tags() as tag}
                <span>#{tag}</span>
              {/each}
            </div>
          {/if}

          <div class="actions">
            <button class="back-btn" onclick={() => (step = 1)} type="button">
              Back
            </button>
            <button
              class="publish-btn"
              disabled={publishing || !caption.trim()}
              onclick={publish}
              type="button"
            >
              {#if publishing}
                <span class="spinner"></span>
                Uploading to IPFS...
              {:else}
                Publish to IPFS
              {/if}
            </button>
          </div>

          {#if publishMessage}
            <div class="status success">
              <p>{publishMessage}</p>
              {#if publishedCid}
                <div class="success-actions">
                  <button type="button" onclick={copyCid}>Copy CID</button>
                  <button type="button" onclick={() => goto("/feed")}>
                    View in Feed
                  </button>
                </div>
              {/if}
            </div>
          {/if}

          {#if publishError}
            <div class="status error">{publishError}</div>
          {/if}
        </div>
      </div>
    </section>
  {/if}

  {#if toast}
    <div class="toast">{toast}</div>
  {/if}
</main>

<style>
  .create-shell {
    max-width: 1100px;
    margin: 2rem auto;
    padding: 0 1rem 2rem;
    color: #e8e8e8;
  }

  .create-header h1 {
    margin: 0;
    font-size: 2rem;
  }

  .create-header p {
    margin-top: 0.25rem;
    color: #9ca3af;
  }

  .card {
    margin-top: 1.25rem;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    padding: 1rem;
  }

  .dropzone {
    border: 2px dashed rgba(255, 255, 255, 0.3);
    border-radius: 14px;
    padding: 2.5rem 1rem;
    text-align: center;
    transition: all 0.2s ease;
  }

  .dropzone.dragging {
    border-color: #60a5fa;
    background: rgba(96, 165, 250, 0.08);
    animation: pulse 1s infinite;
  }

  .subtle {
    color: #9ca3af;
  }

  .browse-btn {
    margin-top: 0.75rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.65rem 1rem;
    border-radius: 10px;
    background: #111827;
    border: 1px solid rgba(255, 255, 255, 0.2);
    cursor: pointer;
  }

  .browse-btn input {
    display: none;
  }

  .preview-card {
    margin-top: 1rem;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    overflow: hidden;
    min-height: 180px;
    background: #0b0f1a;
  }

  .preview-card img,
  .preview-card video {
    width: 100%;
    max-height: 320px;
    object-fit: contain;
    display: block;
  }

  .file-fallback {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
  }

  .file-fallback.full {
    min-height: 300px;
    justify-content: center;
  }

  .file-icon {
    font-size: 2rem;
  }

  .file-meta {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .file-meta span {
    color: #9ca3af;
    font-size: 0.9rem;
  }

  .text-only {
    margin-top: 1rem;
  }

  textarea,
  input {
    width: 100%;
    box-sizing: border-box;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.18);
    color: #f3f4f6;
    border-radius: 10px;
    padding: 0.7rem;
    margin-top: 0.4rem;
    outline: none;
  }

  .compose-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    min-height: 480px;
  }

  .left-preview {
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    overflow: hidden;
    background: #0b0f1a;
    min-height: 460px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .left-preview img,
  .left-preview video {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .text-placeholder {
    color: #9ca3af;
    text-align: center;
  }

  .right-form {
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
  }

  .visibility-toggle {
    display: flex;
    gap: 0.5rem;
  }

  .visibility-toggle button {
    flex: 1;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.06);
    color: #f3f4f6;
    padding: 0.6rem;
    cursor: pointer;
  }

  .visibility-toggle button.active {
    border-color: #60a5fa;
    background: rgba(96, 165, 250, 0.2);
  }

  .tag-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .tag-pills span {
    background: rgba(96, 165, 250, 0.15);
    border: 1px solid rgba(96, 165, 250, 0.45);
    border-radius: 999px;
    padding: 0.25rem 0.6rem;
    font-size: 0.85rem;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.6rem;
    margin-top: 0.6rem;
  }

  button {
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.1);
    color: #f3f4f6;
    padding: 0.65rem 1rem;
    cursor: pointer;
  }

  .publish-btn {
    background: #1d4ed8;
    border-color: #2563eb;
  }

  button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .status {
    border-radius: 10px;
    padding: 0.7rem;
    font-size: 0.95rem;
  }

  .status.success {
    background: rgba(16, 185, 129, 0.16);
    border: 1px solid rgba(16, 185, 129, 0.4);
  }

  .status.error {
    background: rgba(239, 68, 68, 0.14);
    border: 1px solid rgba(239, 68, 68, 0.4);
  }

  .success-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.6rem;
  }

  .spinner {
    width: 0.9rem;
    height: 0.9rem;
    border: 2px solid rgba(255, 255, 255, 0.35);
    border-top-color: #fff;
    border-radius: 50%;
    display: inline-block;
    margin-right: 0.45rem;
    animation: spin 0.8s linear infinite;
  }

  .toast {
    position: fixed;
    top: 1rem;
    right: 1rem;
    background: #111827;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 10px;
    padding: 0.7rem 0.85rem;
    z-index: 50;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @keyframes pulse {
    0%,
    100% {
      box-shadow: 0 0 0 rgba(96, 165, 250, 0);
    }
    50% {
      box-shadow: 0 0 0.9rem rgba(96, 165, 250, 0.35);
    }
  }

  @media (max-width: 900px) {
    .compose-grid {
      grid-template-columns: 1fr;
      min-height: auto;
    }

    .left-preview {
      min-height: 250px;
    }
  }
</style>
