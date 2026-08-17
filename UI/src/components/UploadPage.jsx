import { useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { resetUpload, uploadCsv } from "../features/upload/uploadSlice.js";

export default function UploadPage() {
    const dispatch = useDispatch();
    const { status, result, error, fileName } = useSelector((state) => state.upload);
    const [file, setFile] = useState(null);
    const [dragOver, setDragOver] = useState(false);
    const inputRef = useRef(null);

    const uploading = status === "uploading";

    const handleFiles = (files) => {
        const selected = files?.[0];
        if (!selected) return;
        dispatch(resetUpload());
        setFile(selected);
    };

    const handleSubmit = (event) => {
        event.preventDefault();
        if (!file || uploading) return;
        dispatch(uploadCsv(file));
    };

    const handleDrop = (event) => {
        event.preventDefault();
        setDragOver(false);
        handleFiles(event.dataTransfer.files);
    };

    return (
        <section id="profiles" className="card">
            <h1 className="card-title">Import Profiles</h1>
            <p className="card-subtitle">
                Choose a CSV file containing a <code>linkedin_url</code> column. Valid profiles are
                upserted into the database.
            </p>

            <form onSubmit={handleSubmit}>
                <div
                    className={`dropzone${dragOver ? " drag-over" : ""}`}
                    onClick={() => inputRef.current?.click()}
                    onDragOver={(event) => {
                        event.preventDefault();
                        setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                >
                    <input
                        ref={inputRef}
                        type="file"
                        accept=".csv,text/csv"
                        hidden
                        onChange={(event) => handleFiles(event.target.files)}
                    />
                    <span className="dropzone-icon" aria-hidden="true">
                        <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <path d="M14 2v6h6" />
                            <path d="M8 13h8" />
                            <path d="M8 17h5" />
                        </svg>
                    </span>
                    <p className="dropzone-text">
                        {file ? (
                            <>
                                <strong>{file.name}</strong>
                                <span>Click or drop another file to replace it.</span>
                            </>
                        ) : (
                            <>
                                <strong>Click to choose a CSV file</strong>
                                <span>or drag and drop it here</span>
                            </>
                        )}
                    </p>
                </div>

                <button type="submit" className="btn btn-primary btn-block" disabled={!file || uploading}>
                    {uploading ? "Uploading…" : "Upload CSV"}
                </button>
            </form>

            {uploading && (
                <div className="alert alert-info" role="status">
                    <span className="spinner" aria-hidden="true" />
                    Uploading {fileName} and importing profiles…
                </div>
            )}

            {status === "success" && result && (
                <div className="alert alert-success" role="status">
                    <div className="alert-heading">Upload successful!</div>
                    <div>
                        {result.imported} profile{result.imported === 1 ? "" : "s"} imported
                        {result.dropped ? `, ${result.dropped} row(s) skipped (missing URL)` : ""}
                        {result.invalidUrls ? `, ${result.invalidUrls} invalid URL(s) skipped` : ""}
                        {result.duplicates ? `, ${result.duplicates} duplicate(s) skipped` : ""}.
                    </div>
                </div>
            )}

            {status === "error" && (
                <div className="alert alert-error" role="alert">
                    <div className="alert-heading">Upload failed</div>
                    <div>{error}</div>
                </div>
            )}
        </section>
    );
}