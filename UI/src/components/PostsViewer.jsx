import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchProfiles } from "../features/profiles/profilesSlice.js";
import { fetchPosts } from "../features/posts/postsSlice.js";

function CopyButton({ text, label }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            setCopied(false);
        }
    };

    return (
        <button type="button" className={`copy-btn${copied ? " copied" : ""}`} onClick={handleCopy}>
            {copied ? "Copied!" : label}
        </button>
    );
}

function ProfilePosts({ postsState }) {
    if (postsState.status === "loading") {
        return (
            <div className="alert alert-info" role="status">
                <span className="spinner" aria-hidden="true" />
                Loading posts…
            </div>
        );
    }

    if (postsState.status === "error") {
        return (
            <div className="alert alert-error" role="alert">
                <div className="alert-heading">Could not load posts</div>
                <div>{postsState.error}</div>
            </div>
        );
    }

    if (postsState.status !== "success" || !postsState.profile) return null;

    return (
        <>
            <div className="profile-meta">
                <strong>{postsState.profile.display_name || "Profile"}</strong>
                {postsState.profile.team ? (
                    <span className="profile-team">{postsState.profile.team}</span>
                ) : null}
                <span className="post-count">
                    {postsState.posts.length} post{postsState.posts.length === 1 ? "" : "s"}
                </span>
            </div>

            {postsState.posts.length === 0 ? (
                <div className="alert alert-info">
                    No posts have been scraped for this profile yet. Run the automation
                    (Linkedin-Scraper) to scrape its posts.
                </div>
            ) : (
                <ul className="posts-list">
                    {postsState.posts.map((post, index) => (
                        <li key={index} className="post-item">
                            <div className="post-meta">
                                <span className="post-date">
                                    {post.published_at || "Unknown date"}
                                </span>
                            </div>
                            {post.summary && (
                                <div className="post-summary">
                                    <p>{post.summary}</p>
                                    <CopyButton text={post.summary} label="Copy summary" />
                                </div>
                            )}
                            <details className="post-raw">
                                <summary>View raw post</summary>
                                <p>{post.raw_text}</p>
                                <CopyButton text={post.raw_text} label="Copy raw post" />
                            </details>
                        </li>
                    ))}
                </ul>
            )}
        </>
    );
}

export default function PostsViewer() {
    const dispatch = useDispatch();
    const profiles = useSelector((state) => state.profiles);
    const postsState = useSelector((state) => state.posts);
    const uploadStatus = useSelector((state) => state.upload.status);
    const [selectedUrl, setSelectedUrl] = useState(null);

    const profilesLoading = profiles.status === "loading";
    const postsLoading = postsState.status === "loading";

    useEffect(() => {
        dispatch(fetchProfiles());
    }, [dispatch]);

    useEffect(() => {
        if (uploadStatus === "success") dispatch(fetchProfiles());
    }, [dispatch, uploadStatus]);

    const handleGetPosts = (url) => {
        if (postsLoading) return;
        setSelectedUrl(url);
        dispatch(fetchPosts(url));
    };

    return (
        <section id="posts" className="card">
            <h2 className="card-title">View Posts</h2>
            <p className="card-subtitle">
                Select a profile to see the posts stored for it.
            </p>

            {profiles.status === "error" && (
                <div className="alert alert-error" role="alert">
                    <div className="alert-heading">Could not load profiles</div>
                    <div>{profiles.error}</div>
                </div>
            )}

            {profilesLoading && (
                <div className="alert alert-info" role="status">
                    <span className="spinner" aria-hidden="true" />
                    Loading profiles…
                </div>
            )}

            {profiles.status === "success" && profiles.items.length === 0 && (
                <div className="alert alert-info">
                    No profiles imported yet. Upload a CSV above to get started.
                </div>
            )}

            {profiles.status === "success" && profiles.items.length > 0 && (
                <ul className="profiles-list">
                    {profiles.items.map((profile) => (
                        <li key={profile.id} className="profile-entry">
                            <div className="profile-row">
                                <div className="profile-info">
                                    <div className="profile-row-top">
                                        <strong>{profile.display_name || profile.linkedin_url}</strong>
                                        <span className={`status-badge status-${profile.status}`}>
                                            {profile.status}
                                        </span>
                                        <span
                                            className={`post-count-badge${profile.posts_count > 0 ? " has-posts" : ""}`}
                                            title={
                                                profile.posts_count > 0
                                                    ? "Posts available for this profile"
                                                    : "No posts scraped yet for this profile"
                                            }
                                        >
                                            {profile.posts_count} post{profile.posts_count === 1 ? "" : "s"}
                                        </span>
                                    </div>
                                    <a
                                        className="profile-url"
                                        href={profile.linkedin_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        {profile.linkedin_url}
                                    </a>
                                    {profile.team ? <span className="profile-team">{profile.team}</span> : null}
                                </div>
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={() => handleGetPosts(profile.linkedin_url)}
                                    disabled={postsLoading && selectedUrl === profile.linkedin_url}
                                >
                                    {postsLoading && selectedUrl === profile.linkedin_url
                                        ? "Loading…"
                                        : "Get posts"}
                                </button>
                            </div>
                            {selectedUrl === profile.linkedin_url && (
                                <div className="profile-posts">
                                    <ProfilePosts postsState={postsState} />
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
