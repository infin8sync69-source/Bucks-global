import base64
import json
from typing import Tuple, Optional
import nacl.signing
import nacl.encoding
from nacl.public import PrivateKey, PublicKey
import multibase

def generate_keypair() -> Tuple[str, str, str]:
    """
    Generate a new Ed25519 keypair and return formatted DID and keys.
    Returns:
        did (str): did:key:z...
        public_key_multibase (str): z...
        private_key_hex (str): Hex-encoded private key (secret)
    """
    signing_key = nacl.signing.SigningKey.generate()
    verify_key = signing_key.verify_key
    
    # Serialize public key to bytes
    public_bytes = verify_key.encode(encoder=nacl.encoding.RawEncoder)
    
    # Create valid did:key (ed25519-pub header + bytes)
    # Multicodec for ed25519-pub is 0xed01 (varint extended) -> 0xed 0x01
    # But for did:key, we typically use the multicodec prefix directly.
    # W3C did:key method for Ed25519:
    # 1. 0xed01 (2 bytes) prefix for Ed25519 public key
    # 2. 32 bytes public key
    # 3. Multibase encode with base58btc (z)
    
    # 0xed = 237, 0x01 = 1
    header = bytes([0xed, 0x01])
    pub_key_bytes_with_header = header + public_bytes
    
    # Encode with multibase base58btc
    multibase_key = multibase.encode('base58btc', pub_key_bytes_with_header).decode('utf-8')
    did = f"did:key:{multibase_key}"
    
    # Private key to hex for storage
    private_hex = signing_key.encode(encoder=nacl.encoding.HexEncoder).decode('utf-8')
    
    return did, multibase_key, private_hex

def sign_message(message: str, private_key_hex: str) -> str:
    """Sign a message with the private key"""
    signing_key = nacl.signing.SigningKey(private_key_hex, encoder=nacl.encoding.HexEncoder)
    signed = signing_key.sign(message.encode('utf-8'))
    return base64.b64encode(signed.signature).decode('utf-8')

def verify_message(message: str, signature_b64: str, did: str) -> bool:
    """
    Verify a signature against a DID.
    Resolves the public key from the did:key string.
    """
    try:
        # Extract multibase key from did:key:z...
        if not did.startswith("did:key:"):
            return False
            
        mb_key = did.split(":")[-1]
        
        # Decode multibase
        decoded = multibase.decode(mb_key)
        
        # Check header (0xed01 for Ed25519)
        if len(decoded) != 34 or decoded[0] != 0xed or decoded[1] != 0x01:
            # Could be other key types, but we only support ed25519 for now
            return False
            
        # Extract raw 32-byte public key
        public_bytes = decoded[2:]
        
        verify_key = nacl.signing.VerifyKey(public_bytes)
        
        # Verify
        signature_bytes = base64.b64decode(signature_b64)
        verify_key.verify(message.encode('utf-8'), signature_bytes)
        return True
    except Exception as e:
        print(f"Verification failed: {e}")
        return False

def did_to_peer_id(did: str) -> str:
    """
    Convert a did:key (Ed25519) to a legacy IPFS Peer ID (12D3K...).
    Logic: Base58( Multihash( Protobuf( PublicKey ) ) )
    """
    try:
        if not did.startswith("did:key:"):
            return ""
        
        # did:key:z... -> split by : -> [did, key, z...]
        parts = did.split(":")
        if len(parts) < 3:
            return ""
            
        mb_key = parts[-1]
        decoded = multibase.decode(mb_key)
        
        # Expect header 0xed 0x01
        if len(decoded) > 2 and decoded[0] == 0xed and decoded[1] == 0x01:
            raw_pubkey = decoded[2:]
        else:
            return ""

        # Protobuf Encoding for PublicKey
        # Type: Ed25519 (1) -> Field 1, Type 0 (Varint) -> 08 01
        # Data: raw_pubkey  -> Field 2, Type 2 (Length) -> 12 20 <32 bytes>
        
        # 0x20 is 32.
        protobuf_prefix = bytes([0x08, 0x01, 0x12, 0x20])
        protobuf_serialized = protobuf_prefix + raw_pubkey
        
        # Identity Multihash
        # Code: 0x00
        # Len: varint(len(protobuf_serialized))
        # Digest: protobuf_serialized
        
        length = len(protobuf_serialized) # Should be 4 + 32 = 36
        # Varint of 36 is just 36 (0x24)
        
        multihash_bytes = bytes([0x00, length]) + protobuf_serialized
        
        # Base58 Encode (using bitcoin alphabet usually for IPFS)
        # we need base58 encoding. 
        # multibase 'base58btc' uses 'z' prefix.
        encoded_mb = multibase.encode('base58btc', multihash_bytes).decode('utf-8')
        if encoded_mb.startswith('z'):
            return encoded_mb[1:]
        return encoded_mb
        
    except Exception as e:
        print(f"DID conversion error: {e}")
        return ""
