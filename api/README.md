# NoteSMP API location

The API is maintained in its own repository: [NoteSMP/notesmp-api](https://github.com/NoteSMP/notesmp-api).

Production Worker:
`https://notesmp-api.notesmp-de.workers.dev`

This folder is not a separate or planned API deployment. Do not create a second Worker or database from this note. Make API source, schema and migration changes in the dedicated `notesmp-api` repository.

The website frontend in this repository calls the API's public `/v1` endpoints. Protected Minecraft/plugin endpoints require the server-side `MINECRAFT_API_KEY` and must never be called from browser code.

See the API repository README for the current endpoint reference, D1 schema/migrations, bindings, secrets and deployment instructions.
