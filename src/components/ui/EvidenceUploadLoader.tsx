'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle2, FileUp, Loader2, Scale, ShieldCheck, X } from 'lucide-react';
import { useIsMobile } from "@/hooks/use-mobile";
import { LandingDialog } from "../landing/LandingDialog";
import { FolderFloat, FolderItemProp } from './FolderFloat';

export interface EvidenceUploadLoaderProps {
  isOpen: boolean;
  onClose: () => void;
  caseTitle?: string;
  evidenceItems?: FolderItemProp[];
  onComplete?: () => void;
}

const DEFAULT_EVIDENCE_ITEMS: FolderItemProp[] = [
  'FIR Docket No. 204/2026',
  'Forensic Ballistics Lab Audit',
  'CCTV Timestamp Ledger (Murthal)',
  'Medical Legal Certificate (MLC)',
  'Witness Deposition (Meera)',
  'Fastag GPS Geo-Temporal Log',
];

const PIPELINE_STEPS = [
  { label: 'Digitizing & Hashing Case Exhibits', icon: FileUp },
  { label: 'OCR & Statutory IPC / BNS Section Mapping', icon: Scale },
  { label: 'Auditing Article 21 Urgent Deprivation Threshold', icon: ShieldCheck },
  { label: 'Executing Deterministic CART Decision Tree', icon: CheckCircle2 },
];

export function EvidenceUploadLoader({
  isOpen,
  onClose,
  caseTitle = 'State vs. Singhania (ANV-2026-0051)',
  evidenceItems = DEFAULT_EVIDENCE_ITEMS,
  onComplete,
}: EvidenceUploadLoaderProps) {
  const isMobile = useIsMobile({ includeTouch: true });
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(15);
  const [selectedExhibit, setSelectedExhibit] = useState<string | null>(null);
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setCurrentStep(0);
      setProgress(15);
      setSelectedExhibit(null);
      setIsFinished(false);
      return;
    }

    const t1 = setTimeout(() => { setCurrentStep(1); setProgress(42); }, 1400);
    const t2 = setTimeout(() => { setCurrentStep(2); setProgress(74); }, 2800);
    const t3 = setTimeout(() => { setCurrentStep(3); setProgress(95); }, 4200);
    const t4 = setTimeout(() => {
      setProgress(100);
      setIsFinished(true);
      onComplete?.();
    }, 5400);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [isOpen, onComplete]);

  if (!isOpen) return null;

  return (
    <LandingDialog titleId="evidence-loader-title" onDismiss={onClose} className="max-w-xl">
      <div className="relative w-full rounded-2xl border border-primary/30 bg-surface p-4 sm:p-8 shadow-2xl overflow-hidden text-foreground">
        {/* Ambient Top Glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-48 w-96 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl"
        />

        {/* Modal Header */}
        <div className="flex items-start justify-between gap-2 border-b border-border/60 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary border border-primary/25">
              <Scale className="h-4 w-4" />
            </span>
            <div>
              <h3 id="evidence-loader-title" className="text-sm font-semibold tracking-wide uppercase text-primary">
                Evidence Docket Ingestion
              </h3>
              <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
                {caseTitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-11 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-surface hover:text-foreground transition-colors"
            aria-label="Close upload loader"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Physics Floating Folder Centerpiece */}
        <div className="py-6 flex flex-col items-center justify-center min-h-[300px]">
          <ul className="grid w-full gap-2 sm:grid-cols-2 md:hidden pointer-coarse:grid" aria-label="Case exhibits">
            {evidenceItems.map((item, index) => {
              const label = typeof item === "string" ? item : item.label;
              const value = typeof item === "string" ? item : item.value;
              return (
                <li key={index}>
                  <button
                    type="button"
                    onClick={() => setSelectedExhibit(value)}
                    aria-pressed={selectedExhibit === value}
                    className="min-h-11 w-full rounded-lg border border-border bg-card px-3 py-2 text-left text-sm aria-pressed:border-primary aria-pressed:text-primary"
                  >
                    {label}
                  </button>
                </li>
              );
            })}
          </ul>
          {!isMobile && (
            <div className="hidden flex-col items-center md:flex pointer-coarse:hidden">
              <FolderFloat
                items={evidenceItems}
                label="Case Exhibits"
                sublabel={`${evidenceItems.length} documents`}
                defaultOpen={true}
                trigger="click"
                physics={true}
                drift={0.6}
                width={220}
                height={155}
                radius={14}
                spread={180}
                lift={28}
                folderColor="#1E2029"
                frontColor="#12131A"
                paperColor="#FAF7F0"
                itemColor="#FAF7F0"
                itemTextColor="#14151B"
                labelColor="#C9A227"
                onSelect={(val) => setSelectedExhibit(val)}
              />

              <p className="mt-3 text-[0.7rem] font-mono text-muted-foreground/80 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#C9A227] animate-pulse" />
                Zero-Gravity Evidence Cloud: Drag or throw floating exhibits
              </p>
            </div>
          )}

          {selectedExhibit && (
            <div className="mt-2 text-xs text-primary font-medium bg-primary/10 border border-primary/30 px-3 py-1 rounded-full animate-in zoom-in-95">
              Inspecting: {selectedExhibit}
            </div>
          )}
        </div>

        {/* Multi-Stage Pipeline Progress */}
        <div className="mt-2 space-y-3 border-t border-border/60 pt-4">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-foreground flex items-center gap-2">
              {!isFinished ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              )}
              {isFinished ? 'Triage Complete: Docket Position Recalibrated' : PIPELINE_STEPS[currentStep]?.label}
            </span>
            <span className="font-mono text-xs font-bold text-primary">{progress}%</span>
          </div>

          {/* Progress Track */}
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface border border-border/80">
            <div
              className="h-full bg-gradient-to-r from-primary to-[#C9A227] transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Step Badges */}
          <div className="grid gap-2 pt-1 sm:grid-cols-2 text-[0.68rem] text-muted-foreground font-mono">
            {PIPELINE_STEPS.map((step, idx) => {
              const StepIcon = step.icon;
              const isPast = idx < currentStep || isFinished;
              const isCurrent = idx === currentStep && !isFinished;
              return (
                <div
                  key={step.label}
                  className={`flex items-center gap-1.5 rounded-md px-2 py-1 border transition-colors ${
                    isPast
                      ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400'
                      : isCurrent
                      ? 'border-primary/50 bg-primary/10 text-primary font-semibold'
                      : 'border-border/40 bg-surface/40 text-muted-foreground/60'
                  }`}
                >
                  <StepIcon className="h-3 w-3 shrink-0" />
                  <span>{step.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        {isFinished && (
          <div className="mt-5 flex justify-end gap-2.5 pt-2 animate-in fade-in">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center min-h-11 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-all shadow-md active:scale-95"
            >
              Apply Evidence to Docket
            </button>
          </div>
        )}
      </div>
    </LandingDialog>
  );
}

export default EvidenceUploadLoader;
