import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

export const fetchPosts = createAsyncThunk(
    "posts/fetchPosts",
    async (url, { rejectWithValue }) => {
        let response;
        try {
            response = await fetch(`/api/profiles/posts?url=${encodeURIComponent(url)}`);
        } catch {
            return rejectWithValue("Could not reach the import server. Is the Linkedin-Scraper API running?");
        }
        const data = await response.json().catch(() => ({}));
        if (!response.ok) return rejectWithValue(data.error || `Request failed (HTTP ${response.status}).`);
        return data;
    }
);

const initialState = {
    status: "idle",
    profile: null,
    posts: [],
    error: null,
};

const postsSlice = createSlice({
    name: "posts",
    initialState,
    reducers: {
        resetPosts: (state) => {
            state.status = "idle";
            state.profile = null;
            state.posts = [];
            state.error = null;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchPosts.pending, (state) => {
                state.status = "loading";
                state.error = null;
            })
            .addCase(fetchPosts.fulfilled, (state, action) => {
                state.status = "success";
                state.profile = action.payload.profile;
                state.posts = action.payload.posts;
            })
            .addCase(fetchPosts.rejected, (state, action) => {
                state.status = "error";
                state.error = action.payload || "Something went wrong.";
            });
    },
});

export const { resetPosts } = postsSlice.actions;
export default postsSlice.reducer;