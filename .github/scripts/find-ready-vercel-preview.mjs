const sha = process.argv[2];
const attempts = Number(process.argv[3] || 18);
const delayMs = Number(process.argv[4] || 10000);

if (!sha) throw new Error("Usage: node find-ready-vercel-preview.mjs <sha> [attempts] [delayMs]");
if (!process.env.GH_TOKEN || !process.env.REPOSITORY) {
  throw new Error("GH_TOKEN and REPOSITORY are required");
}

const headers = {
  Accept: "application/vnd.github+json",
  Authorization: `Bearer ${process.env.GH_TOKEN}`,
  "X-GitHub-Api-Version": "2022-11-28",
};

async function api(path) {
  const response = await fetch(`https://api.github.com/repos/${process.env.REPOSITORY}${path}`, { headers });
  if (!response.ok) throw new Error(`GitHub API ${response.status}: ${path}`);
  return response.json();
}

async function findReadyUrl() {
  const deployments = await api(`/deployments?sha=${sha}&per_page=20`);
  for (const deployment of deployments) {
    const statuses = await api(`/deployments/${deployment.id}/statuses?per_page=20`);
    const ready = statuses.find(
      (status) =>
        status.state === "success" &&
        /^https:\/\/[a-z0-9.-]+\.vercel\.app\/?$/i.test(status.environment_url || ""),
    );
    if (ready) return ready.environment_url.replace(/\/$/, "");
  }
  return "";
}

for (let attempt = 0; attempt < attempts; attempt += 1) {
  const url = await findReadyUrl();
  if (url) {
    process.stdout.write(url);
    process.exit(0);
  }
  if (attempt + 1 < attempts) await new Promise((resolve) => setTimeout(resolve, delayMs));
}

throw new Error(`No READY Vercel preview for ${sha}`);
