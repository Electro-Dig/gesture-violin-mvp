# 2026-07-22 sampled violin Netlify deploy verification

## Final draft deploy

- Deploy ID: `6a5fae09b33a184134d227e1`
- State: `ready`
- Context: `deploy-preview`
- `published_at`: empty
- Default demo: <https://6a5fae09b33a184134d227e1--gesture-violin-lab-664.netlify.app/?demo=1>
- Forced synth A/B: <https://6a5fae09b33a184134d227e1--gesture-violin-lab-664.netlify.app/?demo=1&tone=synth>

The draft was created with Netlify's SHA-1 file digest API and a JSON request body containing `draft: true`. All deploy paths used forward slashes. The page, production JavaScript, production CSS, and all twelve MP3 URLs returned HTTP 200. In a Chromium session, the default URL changed to `声音已开启` and fetched twelve samples with HTTP 200; the synth A/B URL changed to `声音已开启` and captured no sample fetches.

## Production preservation

Final read-only site status after the draft deploy:

- Production URL: <https://gesture-violin-lab-664.netlify.app>
- Published deploy ID: `6a573a85c8c09800d5e06301`
- Published title: `Bow direction rhythm rail`

An earlier ZIP API attempt incorrectly entered `production` context despite a `production=false` query. It reached ready state before the cancellation request, so deploy `6a573a85c8c09800d5e06301` was immediately restored and then confirmed as the current published deploy. The ZIP attempt also encoded Windows backslashes in nested paths, so it is not the test link. The final digest-based deploy above is a separate `deploy-preview` with no publication timestamp.

The previous comparison preview remains available at <https://b1f4747-test--gesture-violin-lab-664.netlify.app>.
