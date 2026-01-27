import { useMemo } from 'react';
import { useConstellation } from '../state/constellation';

const SOCIAL_LINKS: { key: 'site' | 'twitter' | 'discord' | 'telegram' | 'nft'; label: string; icon: string }[] = [
  { key: 'site', label: 'Website', icon: '/icons/globe.svg' },
  { key: 'twitter', label: 'X', icon: '/icons/x.svg' },
  { key: 'discord', label: 'Discord', icon: '/icons/discord.svg' },
  { key: 'telegram', label: 'Telegram', icon: '/icons/telegram.svg' },
  { key: 'nft', label: 'NFT', icon: '/icons/nft.svg' }
];

export const ProjectDetailDrawer = () => {
  const { projects, selectedProjectId, selectProject } = useConstellation();
  const project = useMemo(
    () => projects.find((entry) => entry.id === selectedProjectId),
    [projects, selectedProjectId]
  );

  const isVisible = Boolean(project);

  return (
    <aside className={`detail-drawer ${isVisible ? 'is-active' : 'is-hidden'}`} aria-hidden={!isVisible}>
      {project ? (
        <div className="drawer-content">
          <header>
            <div>
              <p className="eyebrow">{project.primaryCategory}</p>
              <h2>{project.name}</h2>
            </div>
            <button className="ghost" type="button" onClick={() => selectProject(null)}>
              Close
            </button>
          </header>
          <p className="summary">{project.summary}</p>
          <section>
            <h3>Categories</h3>
            <div className="badge-row">
              {project.categories.map((category) => (
                <span key={category} className="badge">
                  {category}
                </span>
              ))}
            </div>
          </section>
          <section>
            <h3>Access</h3>
            <div className="icon-link-row">
              {SOCIAL_LINKS.filter(({ key }) => Boolean(project.links[key])).map(({ key, label, icon }) => (
                <a
                  key={key}
                  className="icon-link"
                  href={project.links[key]}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={label}
                >
                  <img src={icon} alt="" aria-hidden />
                  <span>{label}</span>
                </a>
              ))}
            </div>
          </section>
          <section>
            <h3>Active incentives</h3>
            {project.incentives.length === 0 ? (
              <p className="muted">Nothing live right now. Check back soon.</p>
            ) : (
              <ul className="incentive-list">
                {project.incentives.map((incentive) => (
                  <li key={incentive.id}>
                    <h4>{incentive.title}</h4>
                    <p>{incentive.reward}</p>
                    <span className="muted">
                      Ends {new Date(incentive.expiresAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}
    </aside>
  );
};
