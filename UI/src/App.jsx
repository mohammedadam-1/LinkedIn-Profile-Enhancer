import UploadPage from "./components/UploadPage.jsx";
import PostsViewer from "./components/PostsViewer.jsx";

export default function App() {
    return (
        <div className="app">
            <header className="app-header">
                <div className="header-inner">
                    <a className="brand" href="#top">
                        <span className="brand-mark">LP</span>
                        <span className="brand-name">LinkedIn Profile Enhancer</span>
                    </a>
                    <nav className="nav" aria-label="Main navigation">
                        <a className="nav-link" href="#top">Dashboard</a>
                        <a className="nav-link" href="#profiles">Profiles</a>
                        <a className="nav-link active" href="#posts">Posts</a>
                        <a className="nav-link" href="#settings">Settings</a>
                    </nav>
                </div>
            </header>

            <main id="top" className="app-main">
                <div className="app-content">
                    <UploadPage />
                    <PostsViewer />
                </div>
            </main>

            <footer className="app-footer">
                <div className="footer-inner">
                    <div className="footer-top">
                        <div className="footer-brand">
                            <strong>LinkedIn Profile Enhancer</strong>
                            <span>Professional profile and post analysis workspace.</span>
                        </div>
                        <div className="footer-links">
                            <a href="#settings">Privacy</a>
                            <a href="#settings">Terms</a>
                            <a href="#settings">Help</a>
                        </div>
                    </div>
                    <div className="footer-copyright">
                        © 2026 LinkedIn Profile Enhancer. All rights reserved.
                    </div>
                </div>
            </footer>
        </div>
    );
}