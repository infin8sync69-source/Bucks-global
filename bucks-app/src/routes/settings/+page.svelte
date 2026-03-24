
<script lang="ts">
    import { identityStore } from '$lib/stores/identity';
    import { bootstrapNodes } from '$lib/stores/network';
    import { confirmStore } from '$lib/stores/confirm';
    import { toastStore } from '$lib/stores/toast';
    import { goto } from '$app/navigation';
    import { changePassword } from '$lib/crypto/identity';

    const APP_VERSION = '0.1.0';

    let activeTab = $state('identity');

    // Identity
    let oldPassword = $state('');
    let newPassword = $state('');
    let confirmNewPassword = $state('');
    let changingPassword = $state(false);
    let changePasswordError = $state('');
    let changePasswordSuccess = $state('');
    let savingNetwork = $state(false);
    let signingOut = $state(false);

    // Network
    let bootstrapNodesText = $state($bootstrapNodes.join('\\n'));
    const passwordTooShort = $derived(
        newPassword.length > 0 && newPassword.length < 12,
    );
    const passwordsMismatch = $derived(
        confirmNewPassword.length > 0 && newPassword !== confirmNewPassword,
    );
    const canChangePassword = $derived(
        oldPassword.length > 0 &&
            newPassword.length >= 12 &&
            newPassword === confirmNewPassword &&
            !changingPassword,
    );

    async function handleSignOut() {
        const confirmed = await confirmStore.request({
            title: 'Sign Out and Delete Identity',
            message: 'Your local identity will be removed from this device. Continue?',
            confirmText: 'Sign Out',
            cancelText: 'Cancel',
            destructive: true,
        });
        if (!confirmed || signingOut) {
            return;
        }
        signingOut = true;
        try {
            await identityStore.signOut();
            toastStore.success('Signed out successfully.');
            goto('/login');
        } catch (error) {
            toastStore.error(
                error instanceof Error ? error.message : 'Failed to sign out.',
            );
        } finally {
            signingOut = false;
        }
    }

    async function handleChangePassword() {
        if (!canChangePassword) {
            return;
        }
        changingPassword = true;
        changePasswordError = '';
        changePasswordSuccess = '';
        try {
            await changePassword(oldPassword, newPassword);
            changePasswordSuccess = 'Password changed successfully!';
            toastStore.success('Password changed successfully.');
            oldPassword = '';
            newPassword = '';
            confirmNewPassword = '';
        } catch (e: any) {
            const message = e instanceof Error ? e.message : 'Failed to change password.';
            changePasswordError = message;
            toastStore.error(message);
        } finally {
            changingPassword = false;
        }
    }

    function handleSaveNetworkSettings() {
        savingNetwork = true;
        $bootstrapNodes = bootstrapNodesText.split('\\n').map(s => s.trim()).filter(Boolean);
        toastStore.success('Network settings saved. Restart app to apply.');
        savingNetwork = false;
    }

    async function copyToClipboard(text: string) {
        try {
            await navigator.clipboard.writeText(text);
            toastStore.success('Copied to clipboard.');
        } catch {
            toastStore.error('Could not copy to clipboard.');
        }
    }
</script>

<div class="settings-page">
    <h1>Settings</h1>

    <div class="tabs">
        <button class:active={activeTab === 'identity'} onclick={() => activeTab = 'identity'}>Identity</button>
        <button class:active={activeTab === 'network'} onclick={() => activeTab = 'network'}>Network</button>
        <button class:active={activeTab === 'about'} onclick={() => activeTab = 'about'}>About</button>
    </div>

    <div class="tab-content">
        {#if activeTab === 'identity'}
            <div class="setting-section">
                <h2>Identity</h2>
                <div class="info-row">
                    <strong>DID:</strong>
                    <span class="hint" title="Decentralized Identifier for your social identity.">?</span>
                    <input type="text" readonly value={$identityStore.identity?.did} />
                    <button onclick={() => copyToClipboard($identityStore.identity?.did || '')}>Copy</button>
                </div>
                <div class="info-row">
                    <strong>PeerID:</strong>
                    <span class="hint" title="Networking ID used for P2P chat and replication.">?</span>
                    <input type="text" readonly value={$identityStore.identity?.peerId} />
                    <button onclick={() => copyToClipboard($identityStore.identity?.peerId || '')}>Copy</button>
                </div>

                <hr />

                <h3>Change Password</h3>
                <input type="password" bind:value={oldPassword} placeholder="Old Password" />
                <input type="password" bind:value={newPassword} placeholder="New Password" />
                <input type="password" bind:value={confirmNewPassword} placeholder="Confirm New Password" />
                <button onclick={handleChangePassword} disabled={!canChangePassword}>
                    {changingPassword ? 'Changing...' : 'Change Password'}
                </button>
                {#if passwordTooShort}
                    <p class="error">Password must be at least 12 characters.</p>
                {/if}
                {#if passwordsMismatch}
                    <p class="error">Passwords do not match.</p>
                {/if}
                {#if changePasswordError}<p class="error">{changePasswordError}</p>{/if}
                {#if changePasswordSuccess}<p class="success">{changePasswordSuccess}</p>{/if}

                <hr />
                
                <h3>Sign Out</h3>
                <button class="danger" onclick={handleSignOut} disabled={signingOut}>
                    {signingOut ? 'Signing out...' : 'Sign Out & Delete Identity'}
                </button>
            </div>
        {:else if activeTab === 'network'}
            <div class="setting-section">
                <h2>Network</h2>
                <h3>Bootstrap Nodes</h3>
                <p>One multiaddress per line. Changes require an app restart.</p>
                <textarea rows="5" bind:value={bootstrapNodesText}></textarea>
                <button onclick={handleSaveNetworkSettings} disabled={savingNetwork}>
                    {savingNetwork ? 'Saving...' : 'Save Network Settings'}
                </button>
            </div>
        {:else if activeTab === 'about'}
            <div class="setting-section">
                <h2>About Bucks</h2>
                <p>Version: {APP_VERSION}</p>
                <a href="https://github.com/your-repo/bucks-global" target="_blank" rel="noopener noreferrer">View Source on GitHub</a>
            </div>
        {/if}
    </div>
</div>

<style>
    .settings-page {
        padding: 2rem;
        max-width: 800px;
        margin: 0 auto;
    }
    .tabs {
        display: flex;
        border-bottom: 1px solid rgba(255,255,255,0.1);
        margin-bottom: 2rem;
    }
    .tabs button {
        padding: 1rem;
        background: none;
        border: none;
        color: var(--text-medium);
        cursor: pointer;
        border-bottom: 2px solid transparent;
    }
    .tabs button.active {
        color: var(--primary-accent);
        border-bottom-color: var(--primary-accent);
    }
    .setting-section h2 {
        margin-top: 0;
    }
    .info-row {
        display: flex;
        align-items: center;
        gap: 1rem;
        margin-bottom: 1rem;
    }
    .hint {
        width: 1.2rem;
        height: 1.2rem;
        border-radius: 9999px;
        border: 1px solid rgba(255,255,255,0.25);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 0.7rem;
        color: #d6d7e2;
        cursor: help;
    }
    .info-row input {
        flex-grow: 1;
    }
    textarea {
        width: 100%;
        background: rgba(0,0,0,0.2);
        color: var(--text-light);
        border: 1px solid var(--text-medium);
        border-radius: 0.5rem;
        padding: 0.5rem;
    }
    .error { color: #ff8a8a; }
    .success { color: #b9f6ca; }
    hr {
        border: none;
        border-top: 1px solid rgba(255,255,255,0.1);
        margin: 2rem 0;
    }
    button.danger {
        background: #ff8a8a;
        color: #111;
    }
    button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
</style>
