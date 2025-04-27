# Refactor `backend/src/index.ts`

**Status: Completed**

This file exceeds the recommended line count (408 lines). Refactor it by separating concerns.

## Tasks

- [x] **Analyze `index.ts`:**
    - [x] Identify distinct logical sections (e.g., Express setup, middleware, route definitions, helper functions, core logic).
    - [x] Determine which sections can be extracted into separate modules/files. Potential candidates:
        - Route handlers (e.g., `/upload`, `/convert`, `/status`, `/download`).
        - Middleware functions.
        - Utility functions (e.g., file handling, validation).
        - Business logic related to conversion or file management.
    - **Note**: Identified sections for extraction including route handlers, middleware, WebSocket handling, queue management, and utility functions.
- [x] **Create New Files/Folders:**
    - [x] Plan a new structure within `backend/src/` (e.g., `routes/`, `middleware/`, `utils/`, `services/`).
    - [x] Create the necessary new files based on the analysis (e.g., `backend/src/routes/upload.ts`, `backend/src/utils/fileHelper.ts`).
    - **Note**: Created `routes/`, `middleware/`, `services/`, and `utils/` directories with respective files for upload, download, status, queue management, WebSocket service, and directory setup.
- [x] **Move Code:**
    - [x] Carefully move the identified code sections from `index.ts` to the new files.
    - [x] Ensure correct exports are added to the new files.
    - **Note**: Moved code for routes, middleware, queue management, and WebSocket handling to their respective files with proper exports.
- [x] **Update Imports/Exports:**
    - [x] Update `index.ts` to import the moved functionalities from the new modules.
    - [x] Remove the original code from `index.ts`.
    - [x] Update any internal imports within the newly created files if necessary.
    - **Note**: Updated `index.ts` to import functionalities from new modules and removed the original code. Internal imports in new files are set up correctly.
- [x] **Verification:**
    - [x] Ensure `index.ts` is significantly smaller and focused on bootstrapping the application.
    - [x] Run the backend application (`npm run start:dev` after potential rebuild if needed).
    - [x] Test all API endpoints previously handled by `index.ts` to ensure functionality remains unchanged.
    - [x] Check for any runtime errors or unexpected behavior.
    - **Note**: `index.ts` has been reduced significantly. Verification through running the application and testing endpoints confirmed that functions work as expected. 