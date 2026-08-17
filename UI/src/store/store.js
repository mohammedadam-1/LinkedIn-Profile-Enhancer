import { configureStore } from "@reduxjs/toolkit";
import uploadReducer from "../features/upload/uploadSlice.js";
import postsReducer from "../features/posts/postsSlice.js";
import profilesReducer from "../features/profiles/profilesSlice.js";

export const store = configureStore({
    reducer: {
        upload: uploadReducer,
        posts: postsReducer,
        profiles: profilesReducer,
    },
});