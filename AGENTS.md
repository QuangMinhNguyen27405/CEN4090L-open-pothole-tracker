# Frontend migration constraints

- The user requires the final frontend to look exactly like the original project in `../open-pothole-map-repo`. Treat that repository as the visual source of truth.
- Migrate the original components, CSS, assets, visible text, spacing, colors, animations, map settings, and responsive behavior. Do not redesign or replace them with a different presentation unless the user requests it.
- Stage functionality by increment. Increment 1 covers the app layout, public home page, interactive map, markers, and read-only pothole details. Add deferred camera, driving, notifications, and community controls using their original UI in later increments.
- Keep necessary PostgreSQL/API, configuration, and typing adaptations behind the original presentation. Preserve work already present in the target repository.
- Compare migrated source with the original and run build/lint checks. Do not claim pixel-identical rendering without a browser comparison using the same viewport, theme, map settings, location, and data.
