import React, { useState } from 'react';
import {
  InfrastructureNode,
  InfrastructureNodeType,
  RelationshipType,
  NewRelationshipForm,
} from '../infrastructureMap.types';

interface AddRelationshipModalProps {
  isOpen: boolean;
  nodes: InfrastructureNode[];
  onClose: () => void;
  onAdd: (form: NewRelationshipForm) => void;
}

export const AddRelationshipModal: React.FC<AddRelationshipModalProps> = ({
  isOpen,
  nodes,
  onClose,
  onAdd,
}) => {
  const [sourceType, setSourceType] = useState<InfrastructureNodeType>('email');
  const [sourceId, setSourceId] = useState<string>('email-infra');
  const [targetType, setTargetType] = useState<InfrastructureNodeType>('provider');
  const [targetId, setTargetId] = useState<string>('prov-hostinger');
  const [relationshipType, setRelationshipType] = useState<RelationshipType>('owns');
  const [notes, setNotes] = useState<string>('');

  if (!isOpen) return null;

  const availableSourceNodes = nodes.filter((n) => n.nodeType === sourceType);
  const availableTargetNodes = nodes.filter((n) => n.nodeType === targetType);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceId || !targetId) return;

    onAdd({
      sourceType,
      sourceId,
      targetType,
      targetId,
      relationshipType,
      notes: notes.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="bg-surface-container-lowest w-full max-w-lg rounded-xl shadow-xl border border-outline-variant/30 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-unit-lg py-unit-md border-b border-surface-container/60 bg-surface-container-low">
          <div className="flex items-center gap-unit-xs">
            <span className="material-symbols-outlined text-primary text-[20px]">add_link</span>
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              Add Stored Relationship
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-secondary hover:text-on-surface transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-unit-lg flex flex-col gap-unit-md">
          {/* Source Node Section */}
          <div className="flex flex-col gap-2 p-unit-sm rounded-lg bg-surface-container-low border border-outline-variant/20">
            <span className="font-caption-xs text-caption-xs uppercase text-secondary font-semibold">
              1. Source Entity
            </span>
            <div className="grid grid-cols-2 gap-unit-sm">
              <select
                value={sourceType}
                onChange={(e) => {
                  const st = e.target.value as InfrastructureNodeType;
                  setSourceType(st);
                  const first = nodes.find((n) => n.nodeType === st);
                  if (first) setSourceId(first.id);
                }}
                className="h-9 px-unit-sm rounded-lg bg-surface-container-lowest text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-1 focus:ring-primary border border-outline-variant/30 cursor-pointer"
              >
                <option value="email">Email</option>
                <option value="provider">Provider Account</option>
                <option value="domain">Domain</option>
                <option value="server">VPS / Server</option>
                <option value="website">Website / App</option>
              </select>

              <select
                value={sourceId}
                onChange={(e) => setSourceId(e.target.value)}
                className="h-9 px-unit-sm rounded-lg bg-surface-container-lowest text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-1 focus:ring-primary border border-outline-variant/30 cursor-pointer"
              >
                {availableSourceNodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Relationship Type */}
          <div className="flex flex-col gap-1">
            <label className="font-label-md text-label-md text-on-surface font-semibold">
              Relationship Binding Type
            </label>
            <select
              value={relationshipType}
              onChange={(e) => setRelationshipType(e.target.value as RelationshipType)}
              className="h-9 px-unit-sm rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-1 focus:ring-primary border border-outline-variant/30 cursor-pointer"
            >
              <option value="owns">owns / account owner</option>
              <option value="manages">manages / registrar authority</option>
              <option value="resolves_to">resolves to / DNS A/CNAME</option>
              <option value="hosts">hosts / compute instance</option>
              <option value="attached_to">attached to / reverse proxy</option>
            </select>
          </div>

          {/* Target Node Section */}
          <div className="flex flex-col gap-2 p-unit-sm rounded-lg bg-surface-container-low border border-outline-variant/20">
            <span className="font-caption-xs text-caption-xs uppercase text-secondary font-semibold">
              2. Target Entity
            </span>
            <div className="grid grid-cols-2 gap-unit-sm">
              <select
                value={targetType}
                onChange={(e) => {
                  const tt = e.target.value as InfrastructureNodeType;
                  setTargetType(tt);
                  const first = nodes.find((n) => n.nodeType === tt);
                  if (first) setTargetId(first.id);
                }}
                className="h-9 px-unit-sm rounded-lg bg-surface-container-lowest text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-1 focus:ring-primary border border-outline-variant/30 cursor-pointer"
              >
                <option value="provider">Provider Account</option>
                <option value="domain">Domain</option>
                <option value="server">VPS / Server</option>
                <option value="website">Website / App</option>
                <option value="project">Project</option>
              </select>

              <select
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                className="h-9 px-unit-sm rounded-lg bg-surface-container-lowest text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-1 focus:ring-primary border border-outline-variant/30 cursor-pointer"
              >
                {availableTargetNodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Optional Notes */}
          <div className="flex flex-col gap-1">
            <label className="font-label-md text-label-md text-on-surface font-semibold">
              Relationship Notes / Stored Binding
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Port 3000 / Next.js production daemon"
              className="h-9 px-unit-sm rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-1 focus:ring-primary border border-outline-variant/30"
            />
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-unit-sm pt-unit-xs border-t border-surface-container/60">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-unit-md rounded-lg bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors font-label-md text-label-md cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-9 px-unit-md rounded-lg bg-primary text-on-primary hover:bg-tertiary transition-colors shadow-micro font-label-md text-label-md cursor-pointer"
            >
              Save Relationship
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
