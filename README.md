# RepoCards

[Open the card studio](https://rogfog.github.io/RepoCards/), enter a public GitHub
repository, and download its metadata as an SVG. Commit the card beside a README
to keep a copy of the repository information at the time it was captured.

![RepoCards studio](docs/screenshot.png)

## From repository to README

1. Enter `ROGFOG/PolicyLens` or its HTTPS GitHub URL.
2. Choose Paper or Night and create the card.
3. Save the SVG as `assets/repository-card.svg` in your repository.
4. Copy the Markdown snippet into your README.

Each 560 × 300 card contains the description, language, star/fork counts, last
push date, latest release and latest workflow result when available. Long text
is shortened; SVG title and description keep accessible text.

The capture time is set once after the requests finish, using the device clock,
and displayed in UTC. Palette changes and downloads preserve it. The built-in
sample is labelled as sample data and has no capture time.

## Known issues and data handling

The downloaded image is a snapshot; regenerate it to refresh the metadata.
The workflow field refers to one latest run, which may belong to another branch.
GitHub's unauthenticated API limits can prevent loading a repository. Optional
release/workflow failures appear as unavailable while the rest of the card remains
usable. Older card data without a capture time shows unavailable for that field.

Requests go from the browser to `api.github.com`, without credentials or a
referrer. GitHub receives the repository query and ordinary network metadata.
The app has no accounts, analytics, proxy or persistent storage.

## Work on the renderer

Node.js 24+ and npm:

```sh
npm ci --ignore-scripts
npm test
npm run dev
```

Open http://127.0.0.1:4173. `npm run build` creates `dist/` for Pages.

`src/card.ts` contains URL validation, API requests and SVG rendering;
`src/main.ts` connects them to the preview and download controls. The renderer
escapes metadata as XML and removes invalid XML characters, including isolated
UTF-16 surrogates. Cards contain no scripts, external images or font downloads.

Checked on Windows with Node.js 24.14.0: 12 tests and the TypeScript/static build.
Tests cover both palettes, escaping, missing metadata, rate limits and capture
times. [Как формируется карточка](docs/design.ru.md) follows the data through the
three API requests and renderer. [MIT license](LICENSE).
