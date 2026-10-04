import { app } from "./app.ts";

const port = Number(process.env.PORT ?? 8000);

app.listen(port, () => console.log(`API on http://localhost:${port}`));
