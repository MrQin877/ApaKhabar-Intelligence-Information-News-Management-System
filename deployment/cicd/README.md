# GitHub Actions to the existing Azure deployment

Edit in VS Code, push a development branch, open a pull request, and merge into
`main`. Existing Laravel tests run first. The deployment workflow then builds
Linux x64 Laravel and Nginx images, labels/tags them with the complete commit SHA,
and transfers them over SSH. VM2 is reached through VM1, so it needs no public IP.
VM2 is updated first, then VM1. Both local HTTPS endpoints and public HTTPS must
respond successfully. Previous image references are retained for rollback.

This workflow deploys the main website/backend repository only. AI repository
changes, database migrations, seeders, runtime secrets, TLS renewal, infrastructure
changes and backups remain separate operations. No database password change is
performed. Existing user records, posts and uploaded files remain in their current
database/storage. Container replacement may briefly interrupt requests; it is not
a zero-downtime rolling-deployment implementation.

## One-time GitHub setup (before merging the workflow into main)

Create dedicated unencrypted Ed25519 deployment key pairs for each VM. Do not
reuse a person's private key. Register the public keys on the existing deployment
account (`apakhabaradmin`) on their corresponding VM. That account needs
noninteractive `sudo docker` access, as in the current deployment. This permission
effectively grants control of the VM: restrict repository write/merge access to
trusted maintainers, and revoke the dedicated public keys if CI access is retired.

In GitHub, open Settings > Secrets and variables > Actions > Repository secrets:

| Name | Private value |
| --- | --- |
| `APAKHABAR_VM1_DEPLOY_KEY` | Complete dedicated VM1 private-key file |
| `APAKHABAR_VM2_DEPLOY_KEY` | Complete dedicated VM2 private-key file |
| `APAKHABAR_SSH_KNOWN_HOSTS` | Verified public SSH host keys using the aliases below |

The host-key secret contains two lines with public host keys read through already
trusted connections, not keys blindly collected by the workflow:

```text
apakhabar-vm1 ssh-ed25519 BASE64_PUBLIC_HOST_KEY_FOR_VM1
apakhabar-vm2 ssh-ed25519 BASE64_PUBLIC_HOST_KEY_FOR_VM2
```

Optional repository variables (current topology is the default):

| Name | Default |
| --- | --- |
| `APAKHABAR_VM1_HOST` | `85.211.180.78` |
| `APAKHABAR_VM2_HOST` | `172.16.0.5` |
| `APAKHABAR_SSH_USER` | `apakhabaradmin` |

Both VMs must be running. VM1's SSH inbound rules must allow the GitHub-hosted
runner to connect; your laptop-only IP allowlist will not allow hosted runners.
This workflow does not widen NSGs or start VMs automatically. Do not assume a
runner's IP stays the same. If keeping SSH restricted is required, use a deliberate
private-network or fixed-egress runner design rather than repeatedly guessing IPs.
VM2 must permit SSH from VM1's private address. No new Azure service or container
registry is created by this implementation.

## Preserved VM configuration

VM1 retains the repository's `deployment/compose.production.yaml` plus all three
current overrides in `/home/apakhabaradmin/apakhabar-azure`: `compose.azure.yaml`,
`compose.storage.yaml`, and `compose.services.yaml`. VM2 retains
`/home/apakhabaradmin/web2-config/compose.web2.json`. No resolved Compose environment
is printed. Runtime credentials stay on the VMs and are not GitHub secrets.

The current running app replica count is captured per VM and retained. Only app,
Nginx, and (on VM1) workers/scheduler are recreated. AI, translation and database
containers are not recreated. No source `git pull` is necessary: the deployed code
is contained in the immutable images, not the host's working-tree files.

Release files are stored privately at
`/home/apakhabaradmin/apakhabar-cicd/releases/COMMIT_SHA/`. The `images.json` override
is part of the active deployment. For subsequent manual updates, use the complete
Compose file list shown by the running container's
`com.docker.compose.project.config_files` label, including that image override.
Using only the older base Compose file can revert to an older image tag.

## First deployment

1. Add the three secrets and verify connectivity before merging.
2. Review the pull request and its tests; merge into `main`.
3. Watch Actions > Deploy ApaKhabar to Azure.
4. Verify home, login and a news-detail page in the browser after success.

There is also a Run workflow button on `main`. A successful release can be rerun
idempotently while its images are still running. A previously failed/rolled-back
release requires private inspection before retrying; do not delete its rollback
records blindly. The job serializes deployments, never cancels an active rollout,
and reports rollback failures as requiring a manual check. It cannot guarantee
rollback after lost network access or a stopped VM.

For manual rollback, on each affected VM run its corresponding role:

```sh
python3 /home/apakhabaradmin/apakhabar-cicd/releases/COMMIT_SHA/remote_release.py vm2 COMMIT_SHA rollback
# On VM1 use vm1 instead.
```

Previous image data must still exist locally. Do not run global image/volume prune
commands during an incident. The scripts do not automatically delete old images;
monitor disk usage and retain the last known-good releases when planning cleanup.
Temporary transfer archives are deleted after successful deployment.

## Costs and checks

Builds use GitHub-hosted runner time, subject to your GitHub plan's allowance.
Compressed images are transferred directly; no GitHub artifact storage, GHCR,
Azure Container Registry or new paid Azure resources are required. Existing VM,
database, storage, network and load-balancer charges continue; this automation is
not a guarantee of staying within the student credit. Tests and image builds gate
deployment. A homepage 200 does not verify all integrations or authenticated flows.

Run local tooling checks with:

```sh
python3 -m unittest discover -s deployment/cicd/tests -v
```

Required-reviewer environment approvals are not available on every GitHub plan
for private repositories. This workflow uses merging into main as the release
decision rather than silently depending on an unavailable approval feature. Protect
main with pull-request review and available required-check settings for your plan.
