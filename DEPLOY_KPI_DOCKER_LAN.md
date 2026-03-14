# Deploy KPI Via Docker + Domain `kpi.golden` (LAN)

This guide is the single source of truth to run KPI as a Docker service, route it through Nginx Proxy Manager, and access it from other LAN devices using `http://kpi.golden`.

## 1. Goal

- Keep KPI always on (no manual `pnpm start` after reboot).
- Access KPI by domain: `http://kpi.golden`.
- Allow LAN clients to access the same domain.

## 2. Files Added

- `Dockerfile`
- `.dockerignore`
- `docker-compose.yml`

These files containerize the app and connect it to `proxy_net`.

## 3. Prerequisites

- Docker Desktop running.
- Nginx Proxy Manager (NPM) container already running on this machine.
- Router/DNS can add local DNS record.
- Host machine LAN IP known (example: `192.168.1.114`).

## 4. First-time Setup

### 4.1 Create shared reverse-proxy network

Run once:

```powershell
docker network create proxy_net
```

If it already exists, Docker will return an "already exists" message and that is fine.

### 4.2 Build and start KPI container

From project root:

```powershell
cd E:\GPT\kpi_source_code_v3
docker compose up -d --build
docker compose ps
```

Expected result: container `kpi-app` is `Up`.

### 4.3 Verify backend is reachable inside container

```powershell
docker logs kpi-app --tail=100
```

Look for startup log indicating server is listening on port `5000`.

## 5. Configure Nginx Proxy Manager (NPM)

Open NPM UI (default):

- `http://<HOST_IP>:81`

Create proxy host:

1. `Proxy Hosts` -> `Add Proxy Host`
2. `Domain Names`: `kpi.golden`
3. `Scheme`: `http`
4. `Forward Hostname / IP`: `kpi-app`
5. `Forward Port`: `5000`
6. Save

## 6. Configure DNS For LAN Clients

Add DNS record on router/internal DNS:

- `A` record:
  - Name: `kpi.golden`
  - Value: `192.168.1.114` (replace with your host IP)

Then on each LAN client:

```powershell
ipconfig /flushdns
nslookup kpi.golden
```

Expected result: `kpi.golden` resolves to your host IP.

## 7. Open Firewall (Host Machine)

Allow HTTP + NPM admin UI if needed:

```powershell
netsh advfirewall firewall add rule name="NPM_HTTP_80" dir=in action=allow protocol=TCP localport=80
netsh advfirewall firewall add rule name="NPM_UI_81" dir=in action=allow protocol=TCP localport=81
```

Optional HTTPS:

```powershell
netsh advfirewall firewall add rule name="NPM_HTTPS_443" dir=in action=allow protocol=TCP localport=443
```

## 8. Access URLs

- Local machine: `http://kpi.golden`
- Other LAN machines: `http://kpi.golden`

## 9. Reboot Behavior

Container has `restart: unless-stopped`, so KPI restarts automatically when Docker daemon starts.

## 10. Daily Operations

### Update app and redeploy

```powershell
cd E:\GPT\kpi_source_code_v3
docker compose up -d --build
```

### Stop app

```powershell
docker compose down
```

### Start app (without rebuild)

```powershell
docker compose up -d
```

## 11. Quick Troubleshooting

### Domain not resolving

- Check DNS record exists (`kpi.golden -> host IP`).
- Run `ipconfig /flushdns` on client.
- Verify with `nslookup kpi.golden`.

### NPM returns 502/504

- Check `kpi-app` is running: `docker compose ps`
- Check app logs: `docker logs kpi-app --tail=200`
- Confirm NPM target is exactly `kpi-app:5000`.

### Port 80 conflict

- Another service (often IIS) may hold port 80.
- Free port 80 or remap NPM ports and adjust access accordingly.

## 12. Notes For Future Expansion

For any new app:

1. Container joins `proxy_net`
2. New NPM proxy host (`appname.golden` -> `<container>:<port>`)
3. New DNS `A` record (`appname.golden` -> host IP)

Repeat same pattern, no manual long-running terminal command needed.
