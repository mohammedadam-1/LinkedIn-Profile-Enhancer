import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

export const uploadCsv = createAsyncThunk(
    "upload/uploadCsv",
    async (file, { rejectWithValue }) => {
        const formData = new FormData();
        formData.append("file", file);

        let response;
        try {
            response = await fetch("/api/profiles/import", { method: "POST", body: formData });
        } catch {
            return rejectWithValue("Could not reach the import server. Is the Linkedin-Scraper API running?");
        }

        const data = await response.json().catch(() => ({}));
        if (!response.ok) return rejectWithValue(data.error || `Upload failed (HTTP ${response.status}).`);
        return data;
    }
);

const initialState = {
    status: "idle",
    result: null,
    error: null,
    fileName: null,
};

const uploadSlice = createSlice({
    name: "upload",
    initialState,
    reducers: {
        resetUpload: (state) => {
            state.status = "idle";
            state.result = null;
            state.error = null;
            state.fileName = null;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(uploadCsv.pending, (state, action) => {
                state.status = "uploading";
                state.error = null;
                state.result = null;
                state.fileName = action.meta.arg.name;
            })
            .addCase(uploadCsv.fulfilled, (state, action) => {
                state.status = "success";
                state.result = action.payload;
            })
            .addCase(uploadCsv.rejected, (state, action) => {
                state.status = "error";
                state.error = action.payload || "Something went wrong.";
            });
    },
});

export const { resetUpload } = uploadSlice.actions;
export default uploadSlice.reducer;