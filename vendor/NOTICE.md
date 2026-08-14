These files are vendored, unmodified UMD builds pulled from npm so the site
has no runtime dependency on a third-party CDN:

- `tf-core.min.js` — `@tensorflow/tfjs-core` 4.20.0
- `tf-converter.min.js` — `@tensorflow/tfjs-converter` 4.20.0
- `tf-backend-webgl.min.js` — `@tensorflow/tfjs-backend-webgl` 4.20.0
- `pose-detection.min.js` — `@tensorflow-models/pose-detection` 2.1.3

All are © Google LLC, licensed under Apache License 2.0:
https://www.apache.org/licenses/LICENSE-2.0

At runtime, the MoveNet model itself (weights, not code) is still fetched
from Google's servers the first time you click "Start Camera" — that part
needs an internet connection. Everything else runs from these local files.
