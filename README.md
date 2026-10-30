# RSH Smart Tag Showroom

Read-only 3D product showcase, prepared for GitHub Pages.

## Content

Includes 11 product models, 14 product images, color and finish variants, bilingual specifications, and saved gallery layouts. All rendering dependencies and product assets are served from this repository. Browsing does not call the original ChatGPT Site.

This is a snapshot of the published catalog. It has no sign-in, editor, write API, or automatic connection to the original administration site. Product updates must be exported and committed again before they appear here.

## GitHub Pages setup

In repository **Settings → Pages**, select **GitHub Actions**. The publishing workflow extracts the three asset archives into the site artifact and verifies their contents against `snapshot-manifest.json` before deployment. Assets are stored in archives to stay within GitHub web upload limits; published pages serve the extracted files normally. No files are downloaded from the original Site during deployment or browsing.

The final website address must be read from GitHub's Pages deployment; do not treat a guessed `github.io` address as a successful deployment.

## Local verification

Node.js 22 or newer is sufficient; no package installation is required.

```sh
node scripts/verify.mjs
node scripts/preview.mjs
```

Open `http://127.0.0.1:5176/My-tast001/`. This deliberately tests a repository subpath rather than a domain root.

Localhost is only a preview address and cannot be shared with customers.

## Ownership

Product models, images, logo, and catalog content remain the property of their respective owners. Third-party rendering libraries retain their original licenses. No blanket open-source license is granted for company product assets.

## Access verification

After GitHub reports deployment success, verify the actual HTTPS URL, all models and images, language and color switching. Access from mainland China must also be tested on the customer's network; deployment success alone does not establish network reachability.
