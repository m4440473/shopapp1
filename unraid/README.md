# Unraid Offline Install Guide (Shopapp1)

This guide packages Shopapp1 for Unraid with an offline-friendly workflow. It includes:

- A Docker image built on a Windows PC and copied to Unraid.
- A GUI install via the Unraid Docker template (`my-shopapp1.xml`).
- A Docker Compose stack (SQLite default or MySQL optional) for advanced setups.

## 1) Build the image on Windows

From the repository root on your Windows PC:

```bash
docker build -t shopapp1:latest .
docker save -o shopapp1.tar shopapp1:latest
```

Copy `shopapp1.tar` to your Unraid server (e.g., `\\tower\appdata\shopapp1\` or any share).

## 2) Load the image on Unraid (offline)

From an Unraid terminal:

```bash
docker load -i /mnt/user/appdata/shopapp1/shopapp1.tar
```

## 3) GUI install (Unraid Docker template)

1. Copy `unraid/my-shopapp1.xml` into:
   `/boot/config/plugins/dockerMan/templates-user/`
2. In the Unraid UI, go to **Docker → Add Container** and select **Shopapp1**.
3. Fill in the required fields:
   - **APP_BASE_URL**, **NEXTAUTH_URL**, **NEXT_PUBLIC_BASE_URL** (e.g. `http://<unraid-ip>:3000`)
   - **NEXTAUTH_SECRET** (generate a random 32+ character secret)
   - **DATABASE_URL** (SQLite default is prefilled)
   - **ATTACHMENTS_DIR** (defaults to `/app/storage`)
4. Confirm the volume paths:
   - `/mnt/user/appdata/shopapp1/uploads` → `/app/storage`
   - `/mnt/user/appdata/shopapp1/db` → `/app/data`
5. Click **Apply** to start the container.

The container automatically runs `prisma migrate deploy` on startup for production-safe migrations.

## 4) Optional: MySQL profile with Docker Compose

For MySQL, use `docker-compose.yml` with the `mysql` profile.

1. Create an `.env` file from `.env.example` and update values.
2. Set the MySQL database URL in `.env`:

```env
DATABASE_URL="mysql://shopapp1:shopapp1_password@mysql:3306/shopapp1"
```

3. Start the stack:

```bash
docker compose --profile mysql up -d
```

Persistent data locations:

- App uploads: `/mnt/user/appdata/shopapp1/uploads/`
- SQLite DB (if used): `/mnt/user/appdata/shopapp1/db/`
- MySQL data: `/mnt/user/appdata/shopapp1-mysql/`

## 5) Optional: Seed demo data

If you want demo users and sample orders:

```bash
docker exec -it shopapp1 npm run demo:setup
```

