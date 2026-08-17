import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

export const fetchProfiles = createAsyncThunk(
    "profiles/fetchProfiles",
    async (_, { rejectWithValue }) => {
        let response;
        try {
            response = await fetch("/api/profiles");
        } catch {
            return rejectWithValue("Could not reach the import server. Is the Linkedin-Scraper API running?");
        }
        const data = await response.json().catch(() => ({}));
        if (!response.ok) return rejectWithValue(data.error || `Request failed (HTTP ${response.status}).`);
        return data.profiles || [];
    }
);

const initialState = {
    status: "idle",
    items: [],
    error: null,
};

const profilesSlice = createSlice({
    name: "profiles",
    initialState,
    reducers: {
        resetProfiles: (state) => {
            state.status = "idle";
            state.items = [];
            state.error = null;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchProfiles.pending, (state) => {
                state.status = "loading";
                state.error = null;
            })
            .addCase(fetchProfiles.fulfilled, (state, action) => {
                state.status = "success";
                state.items = action.payload;
            })
            .addCase(fetchProfiles.rejected, (state, action) => {
                state.status = "error";
                state.error = action.payload || "Something went wrong.";
            });
    },
});

export const { resetProfiles } = profilesSlice.actions;
export default profilesSlice.reducer;
