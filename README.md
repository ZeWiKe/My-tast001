# RSH Smart Tag Showroom

Read-only 3D product showcase, prepared for GitHub Pages.

## Content

Includes 11 product models, 14 product images, color and finish variants, bilingual specifications, and saved gallery layouts. All rendering dependencies and product assets are served from this repository. Browsing does not call the original ChatGPT Site.

This is a snapshot of the published catalog. It has no sign-in, editor, write API, or automatic connection to the original administration site. Product updates must be exported and committed again before they appear here.

## GitHub Pages setup

In repository **Settings → Pages**, select **GitHub Actions**. The publishing workflow extracts the three asset archives into the site artifact and verifies their contents against `snapshot-manifest.json` before deployment. Assets are stored in archives to stay within GitHub web upload limits; published pages serve the extracted files normally. No files are downloaded from the original Site during deployment or browsing.

The final website address must be read from GitHub's Pages deployment; do not treat a guessed `github.io` address as a successful deployment.

## Published site

https://zewike.github.io/My-tast001/

## Build verification

GitHub Actions assembles `_site` from the display source and three asset archives, then runs:

```sh
node scripts/verify-published.mjs _site
```

This checks the model and image counts and every product asset SHA-256 digest before publishing. The deployment artifact contains the extracted static website; no server-side application is required.

## Ownership

Product models, images, logo, and catalog content remain the property of their respective owners. Third-party rendering libraries retain their original licenses. No blanket open-source license is granted for company product assets.

## Access verification

After GitHub reports deployment success, verify the actual HTTPS URL, all models and images, language and color switching. Access from mainland China must also be tested on the customer's network; deployment success alone does not establish network reachability.
