"""Configuration loader for the agent."""
import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    """Agent configuration."""
    
    # Agent settings
    AGENT_NAME = os.getenv("AGENT_NAME", "Agent-Unknown")
    ENABLE_COMPUTE = os.getenv("ENABLE_COMPUTE", "true").lower() == "true"
    
    # LLM settings
    # Try to load keys from safe storage first
    try:
        from agent.credentials import CredentialManager
        _creds = CredentialManager()
        _stored_openai = _creds.get_secret("OPENAI_API_KEY")
        _stored_gemini = _creds.get_secret("GEMINI_API_KEY")
    except:
        _stored_openai = None
        _stored_gemini = None

    LLM_PROVIDER = os.getenv("LLM_PROVIDER", "ollama")
    OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3")
    OPENAI_API_KEY = _stored_openai or os.getenv("OPENAI_API_KEY", "")
    GEMINI_API_KEY = _stored_gemini or os.getenv("GEMINI_API_KEY", "")
    OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4")
    
    # IPFS settings
    IPFS_API_URL = os.getenv("IPFS_API_URL", "/ip4/127.0.0.1/tcp/5001")
    
    # Swarm settings
    SWARM_TOPIC = os.getenv("SWARM_TOPIC", "collective-intelligence")
    STRICT_GOVERNANCE = os.getenv("STRICT_GOVERNANCE", "false").lower() == "true"
    
    # File crawling settings
    CRAWL_PATHS = os.getenv("CRAWL_PATHS", "~/Documents").split(",")
    IGNORE_PATTERNS = os.getenv("IGNORE_PATTERNS", "*.pyc,*.log,*.tmp").split(",")
    PUBLIC_INDEXING = os.getenv("PUBLIC_INDEXING", "false").lower() == "true"
    INDEX_PATH = os.getenv("INDEX_PATH", "~/.agent_index/index.json")
    
    # Action system settings
    ALLOW_FILE_OPERATIONS = os.getenv("ALLOW_FILE_OPERATIONS", "true").lower() == "true"
    REQUIRE_CONFIRMATION = os.getenv("REQUIRE_CONFIRMATION", "true").lower() == "true"
    AUTO_BACKUP = os.getenv("AUTO_BACKUP", "true").lower() == "true"
    
    # Chat history settings
    CHAT_HISTORY_DIR = os.getenv("CHAT_HISTORY_DIR", "~/.agent_index/chat_history")
    CHAT_AUTO_SAVE = os.getenv("CHAT_AUTO_SAVE", "true").lower() == "true"

    # Browser settings
    CHROME_USER_DATA_DIR = os.path.expanduser("~/Library/Application Support/Google/Chrome")
    CHROME_PROFILE = "Default"  # Profile directory name
    CHROME_EXECUTABLE_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

