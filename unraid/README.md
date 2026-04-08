# Unraid Docker App Guide (ShopApp1)

This folder contains an Unraid-friendly Docker template for ShopApp1:

- Template: `unraid/my-shopapp1.xml`
- Expected image name on the Unraid host: `shopapp1:latest`

The template is set up for:

- port `3000`
- SQLite by default
- persistent uploads at `/mnt/user/appdata/shopapp1/uploads`
- persistent SQLite data at `/mnt/user/appdata/shopapp1/db`
- optional `OPENAI_API_KEY` only if you want the Print Analyzer / BOM AI feature

## 1) Build and move the image

From the repo root on your build machine:

```bash
docker build -t shopapp1:latest .
docker save -o shopapp1.tar shopapp1:latest
```

Copy `shopapp1.tar` to your Unraid server, for example:

- `/mnt/user/appdata/shopapp1/shopapp1.tar`

## 2) Load the image on Unraid

From an Unraid terminal:

```bash
docker load -i /mnt/user/appdata/shopapp1/shopapp1.tar
```

## 3) Install the Unraid template

Copy `unraid/my-shopapp1.xml` to:

```text
/boot/config/plugins/dockerMan/templates-user/
```

Then in the Unraid UI:

1. Go to `Docker`
2. Click `Add Container`
3. Select `ShopApp1`

## 4) Fill in the template values

Required values:

- `APP_BASE_URL`
- `NEXTAUTH_URL`
- `NEXT_PUBLIC_BASE_URL`
- `NEXTAUTH_SECRET`
- `DATABASE_URL`

Recommended defaults:

- `APP_BASE_URL=http://<unraid-ip>:3000`
- `NEXTAUTH_URL=http://<unraid-ip>:3000`
- `NEXT_PUBLIC_BASE_URL=http://<unraid-ip>:3000`
- `DATABASE_URL=file:/app/data/shopapp1.db`
- `ATTACHMENTS_DIR=/app/storage`

Optional:

- `OPENAI_API_KEY`
  Use this only if you want the Print Analyzer / BOM AI route enabled.

## 5) Persistent paths

The template maps:

- `/mnt/user/appdata/shopapp1/uploads` -> `/app/storage`
- `/mnt/user/appdata/shopapp1/db` -> `/app/data`

The container entrypoint runs Prisma production migrations on startup, so the SQLite database file under `/app/data` will be created/updated there.

## 6) First-run data setup

After the container starts, you can seed demo data if you want sample users/orders:

```bash
docker exec -it ShopApp1 npm run demo:setup
```

Or use the basic seed:

```bash
docker exec -it ShopApp1 npm run seed:basic
docker exec -it ShopApp1 npm run set-demo-passwords
```

## 7) Demo users

After `npm run set-demo-passwords`, these accounts are available:

- `admin@example.com`
- `mach1@example.com`
- `mach2@example.com`
- `viewer@example.com`

## Notes

- The template assumes a locally loaded image named `shopapp1:latest`.
- If you later publish the image to a registry, update the `<Repository>` field in `my-shopapp1.xml`.
- If you switch to MySQL, change `DATABASE_URL` and provide the database separately; the template does not spin up MySQL for you.
