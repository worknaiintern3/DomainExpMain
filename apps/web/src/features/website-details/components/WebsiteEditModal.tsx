import React, { useState, useEffect } from 'react';
import { WebsiteDetailData, EnvironmentType } from '../websiteDetails.types';

interface WebsiteEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: WebsiteDetailData;
  onSave: (updated: Partial<WebsiteDetailData>) => void;
}

export const WebsiteEditModal: React.FC<WebsiteEditModalProps> = ({
  isOpen,
  onClose,
  data,
  onSave,
}) => {
  const [name, setName] = useState(data.name);
  const [environment, setEnvironment] = useState<EnvironmentType>(data.environment);
  const [project, setProject] = useState(data.project);
  const [primaryDomain, setPrimaryDomain] = useState(data.primaryDomain);
  const [altHostnames, setAltHostnames] = useState(data.altHostnames.join(', '));
  const [techStack, setTechStack] = useState(data.techStack);
  const [port, setPort] = useState(String(data.port));
  const [reverseProxy, setReverseProxy] = useState(data.reverseProxy);
  const [sourceRepoUrl, setSourceRepoUrl] = useState(data.sourceRepoUrl);
  const [notes, setNotes] = useState(data.deployment.notes);

  useEffect(() => {
    if (isOpen) {
      setName(data.name);
      setEnvironment(data.environment);
      setProject(data.project);
      setPrimaryDomain(data.primaryDomain);
      setAltHostnames(data.altHostnames.join(', '));
      setTechStack(data.techStack);
      setPort(String(data.port));
      setReverseProxy(data.reverseProxy);
      setSourceRepoUrl(data.sourceRepoUrl);
      setNotes(data.deployment.notes);
    }
  }, [isOpen, data]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name,
      environment,
      project,
      primaryDomain,
      altHostnames: altHostnames
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      techStack,
      techStackSummary: `${techStack} • Port ${port}`,
      port: Number(port) || 3000,
      reverseProxy,
      sourceRepoUrl,
      sourceRepoName: sourceRepoUrl.split('/').pop() || data.sourceRepoName,
      deployment: {
        ...data.deployment,
        notes,
        internalTarget: `127.0.0.1:${port}`,
        lastUpdated: 'User Record (Edited)',
      },
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-inverse-surface/60 backdrop-blur-sm z-50 flex items-center justify-center p-unit-md animate-in fade-in duration-150">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-xl bg-surface-container-lowest rounded-xl shadow-2xl p-unit-xl flex flex-col gap-unit-md border border-outline-variant/40 z-10 animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-unit-sm border-b border-surface-container">
          <div className="flex flex-col">
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              Edit Application Configuration
            </h3>
            <p className="font-caption-xs text-caption-xs text-secondary">
              Update inventory mappings, runtime ports, host domain, and deployment notes.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-surface-container text-secondary hover:text-on-surface transition-colors"
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-unit-md">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-unit-md">
            {/* App Name */}
            <div className="flex flex-col gap-1">
              <label className="font-caption-xs text-caption-xs font-label-md uppercase tracking-wider text-secondary font-semibold">
                Application Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="h-9 px-unit-sm rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30"
              />
            </div>

            {/* Environment */}
            <div className="flex flex-col gap-1">
              <label className="font-caption-xs text-caption-xs font-label-md uppercase tracking-wider text-secondary font-semibold">
                Environment *
              </label>
              <select
                value={environment}
                onChange={(e) => setEnvironment(e.target.value as EnvironmentType)}
                className="h-9 px-unit-sm rounded-lg bg-surface-container-low text-on-surface font-label-md text-body-sm focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer border border-outline-variant/30"
              >
                <option value="Production">Production</option>
                <option value="Staging">Staging</option>
                <option value="Development">Development</option>
              </select>
            </div>

            {/* Primary Domain */}
            <div className="flex flex-col gap-1">
              <label className="font-caption-xs text-caption-xs font-label-md uppercase tracking-wider text-secondary font-semibold">
                Primary Domain *
              </label>
              <input
                type="text"
                value={primaryDomain}
                onChange={(e) => setPrimaryDomain(e.target.value)}
                required
                className="h-9 px-unit-sm rounded-lg bg-surface-container-low text-on-surface font-label-mono text-body-sm focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30"
              />
            </div>

            {/* Alt Hostnames */}
            <div className="flex flex-col gap-1">
              <label className="font-caption-xs text-caption-xs font-label-md uppercase tracking-wider text-secondary font-semibold">
                Alt Hostnames (Comma separated)
              </label>
              <input
                type="text"
                value={altHostnames}
                onChange={(e) => setAltHostnames(e.target.value)}
                className="h-9 px-unit-sm rounded-lg bg-surface-container-low text-on-surface font-label-mono text-body-sm focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30"
              />
            </div>

            {/* Project Group */}
            <div className="flex flex-col gap-1">
              <label className="font-caption-xs text-caption-xs font-label-md uppercase tracking-wider text-secondary font-semibold">
                Project Group
              </label>
              <input
                type="text"
                value={project}
                onChange={(e) => setProject(e.target.value)}
                className="h-9 px-unit-sm rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30"
              />
            </div>

            {/* Tech Stack */}
            <div className="flex flex-col gap-1">
              <label className="font-caption-xs text-caption-xs font-label-md uppercase tracking-wider text-secondary font-semibold">
                Tech Stack
              </label>
              <input
                type="text"
                value={techStack}
                onChange={(e) => setTechStack(e.target.value)}
                className="h-9 px-unit-sm rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30"
              />
            </div>

            {/* Configured Port */}
            <div className="flex flex-col gap-1">
              <label className="font-caption-xs text-caption-xs font-label-md uppercase tracking-wider text-secondary font-semibold">
                Configured Port
              </label>
              <input
                type="number"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                className="h-9 px-unit-sm rounded-lg bg-surface-container-low text-on-surface font-label-mono text-body-sm focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30"
              />
            </div>

            {/* Reverse Proxy */}
            <div className="flex flex-col gap-1">
              <label className="font-caption-xs text-caption-xs font-label-md uppercase tracking-wider text-secondary font-semibold">
                Reverse Proxy
              </label>
              <input
                type="text"
                value={reverseProxy}
                onChange={(e) => setReverseProxy(e.target.value)}
                className="h-9 px-unit-sm rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30"
              />
            </div>

            {/* Source Repository URL */}
            <div className="flex flex-col gap-1 md:col-span-2">
              <label className="font-caption-xs text-caption-xs font-label-md uppercase tracking-wider text-secondary font-semibold">
                Source Repository URL
              </label>
              <input
                type="url"
                value={sourceRepoUrl}
                onChange={(e) => setSourceRepoUrl(e.target.value)}
                placeholder="https://github.com/org/repo"
                className="h-9 px-unit-sm rounded-lg bg-surface-container-low text-on-surface font-label-mono text-body-sm focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30"
              />
            </div>

            {/* Deployment Notes */}
            <div className="flex flex-col gap-1 md:col-span-2">
              <label className="font-caption-xs text-caption-xs font-label-md uppercase tracking-wider text-secondary font-semibold">
                Operational &amp; Deployment Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="p-unit-sm rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none border border-outline-variant/30"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-unit-sm pt-unit-sm border-t border-surface-container">
            <button
              onClick={onClose}
              className="h-9 px-unit-lg rounded-lg bg-surface-container text-on-surface font-label-md text-label-md hover:bg-surface-container-high transition-colors border border-outline-variant/30"
              type="button"
            >
              Cancel
            </button>
            <button
              className="h-9 px-unit-lg rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container shadow-sm transition-colors"
              type="submit"
            >
              Save Configuration
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
