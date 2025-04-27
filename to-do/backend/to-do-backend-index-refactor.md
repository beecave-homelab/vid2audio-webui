# Refactor `backend/src/index.ts`

This file exceeds the recommended line count (408 lines). Refactor it by separating concerns.

## Tasks

- [ ] **Analyze `index.ts`:**
    - [ ] Identify distinct logical sections (e.g., Express setup, middleware, route definitions, helper functions, core logic).
    - [ ] Determine which sections can be extracted into separate modules/files. Potential candidates:
        - Route handlers (e.g., `/upload`, `/convert`, `/status`, `/download`).
        - Middleware functions.
        - Utility functions (e.g., file handling, validation).
        - Business logic related to conversion or file management.
- [ ] **Create New Files/Folders:**
    - [ ] Plan a new structure within `backend/src/` (e.g., `routes/`, `middleware/`, `utils/`, `services/`).
    - [ ] Create the necessary new files based on the analysis (e.g., `backend/src/routes/upload.ts`, `backend/src/utils/fileHelper.ts`).
- [ ] **Move Code:**
    - [ ] Carefully move the identified code sections from `index.ts` to the new files.
    - [ ] Ensure correct exports are added to the new files.
- [ ] **Update Imports/Exports:**
    - [ ] Update `index.ts` to import the moved functionalities from the new modules.
    - [ ] Remove the original code from `index.ts`.
    - [ ] Update any internal imports within the newly created files if necessary.
- [ ] **Verification:**
    - [ ] Ensure `index.ts` is significantly smaller and focused on bootstrapping the application.
    - [ ] Run the backend application (`npm run start:dev` after potential rebuild if needed).
    - [ ] Test all API endpoints previously handled by `index.ts` to ensure functionality remains unchanged.
    - [ ] Check for any runtime errors or unexpected behavior. 