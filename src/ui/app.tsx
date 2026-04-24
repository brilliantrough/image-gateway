import { useEffect, useMemo, useState } from "react";
import { ActionBar } from "./components/action-bar.js";
import { ChannelCardList } from "./components/channel-card-list.js";
import { DraftStateBar } from "./components/draft-state-bar.js";
import { GlobalValidationSummary } from "./components/global-summary.js";
import { InvocationStudioPage } from "./components/invocation-studio-page.js";
import { ModelRegistryTable } from "./components/model-registry-table.js";
import { OverviewCards } from "./components/overview-cards.js";
import { ProviderTestBench } from "./components/provider-test-bench.js";
import { SidebarNav } from "./components/sidebar-nav.js";
import type { ModelConfigUpdate } from "./types/config.js";
import {
    createEmptyChannelConfig,
    createEmptyModelConfig,
    exportConfig,
    prioritiesFromResolvedGroups,
    reorderResolvedGroup,
} from "./lib/config-helpers.js";
import { writeStoredConfigPackJson } from "./lib/local-draft-store.js";
import { buildResolvedGroups } from "./lib/resolved-groups.js";
import { validateConfig } from "./lib/validation.js";
import { initialConfig } from "./test-data/initial-config.js";
import "./styles.css";

const defaultFrontendSettings = {
    invocationStudio: {
        minimalMode: false,
    },
};

type UpstreamConfigPageProps = {
    showConfigCenter?: boolean;
    defaultWorkspace?: "config" | "invocation";
    requireAdminLogin?: boolean;
};

export function UpstreamConfigPage(props: UpstreamConfigPageProps) {
    const showConfigCenter = props.showConfigCenter ?? true;
    const requireAdminLogin = props.requireAdminLogin ?? false;
    const initialWorkspace =
        props.defaultWorkspace ?? (showConfigCenter ? "config" : "invocation");
    const [workspace, setWorkspace] = useState<"config" | "invocation">(
        initialWorkspace,
    );

    return (
        <>
            {showConfigCenter ? (
                <div className="workspace-switch">
                    <button
                        type="button"
                        className={workspace === "config" ? "is-active" : ""}
                        onClick={() => setWorkspace("config")}
                    >
                        Config Center
                    </button>
                    <button
                        type="button"
                        className={
                            workspace === "invocation" ? "is-active" : ""
                        }
                        onClick={() => setWorkspace("invocation")}
                    >
                        Invocation Studio
                    </button>
                </div>
            ) : null}
            {workspace === "config" && showConfigCenter ? (
                <AdminConfigGate requireAdminLogin={requireAdminLogin}>
                    {(adminSession) => (
                        <ConfigCenterWorkspace
                            adminSession={
                                requireAdminLogin ? adminSession : undefined
                            }
                        />
                    )}
                </AdminConfigGate>
            ) : (
                <InvocationStudioPage />
            )}
        </>
    );
}

type AdminConfigGateProps = {
    requireAdminLogin: boolean;
    children:
        | React.ReactNode
        | ((session: {
              username: string;
              onLogout: () => Promise<void>;
          }) => React.ReactNode);
};

function AdminConfigGate(props: AdminConfigGateProps) {
    const { requireAdminLogin, children } = props;
    const [isChecking, setIsChecking] = useState(requireAdminLogin);
    const [isAuthenticated, setIsAuthenticated] = useState(!requireAdminLogin);
    const [username, setUsername] = useState("admin");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const logout = async () => {
        try {
            const response = await fetch("/v1/admin/logout", {
                method: "POST",
                credentials: "same-origin",
            });

            if (!response.ok) {
                throw new Error(await readGatewayErrorMessage(response));
            }

            setIsAuthenticated(false);
            setPassword("");
        } catch (nextError) {
            setError(
                nextError instanceof Error
                    ? nextError.message
                    : "Admin logout failed.",
            );
        }
    };

    useEffect(() => {
        if (!requireAdminLogin) {
            return;
        }

        const controller = new AbortController();

        async function loadSession() {
            setIsChecking(true);
            setError("");

            try {
                const response = await fetch("/v1/admin/session", {
                    signal: controller.signal,
                    credentials: "same-origin",
                });

                if (!response.ok) {
                    throw new Error(await readGatewayErrorMessage(response));
                }

                const payload = (await readJsonResponse<{
                    authenticated: boolean;
                    username: string | null;
                }>(response));

                setIsAuthenticated(payload.authenticated);
                if (payload.username) {
                    setUsername(payload.username);
                }
            } catch (nextError) {
                if (!controller.signal.aborted) {
                    setError(
                        nextError instanceof Error
                            ? nextError.message
                            : "Failed to load admin session.",
                    );
                }
            } finally {
                if (!controller.signal.aborted) {
                    setIsChecking(false);
                }
            }
        }

        void loadSession();
        return () => controller.abort();
    }, [requireAdminLogin]);

    const submitLogin = async () => {
        setIsSubmitting(true);
        setError("");

        try {
            const response = await fetch("/v1/admin/login", {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                },
                credentials: "same-origin",
                body: JSON.stringify({
                    username,
                    password,
                }),
            });

            if (!response.ok) {
                throw new Error(await readGatewayErrorMessage(response));
            }

            setIsAuthenticated(true);
            setPassword("");
        } catch (nextError) {
            setError(
                nextError instanceof Error
                    ? nextError.message
                    : "Admin login failed.",
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    const renderChildren = () =>
        typeof children === "function"
            ? children({
                  username,
                  onLogout: logout,
              })
            : children;

    if (!requireAdminLogin) {
        return <>{renderChildren()}</>;
    }

    if (isChecking) {
        return <section className="notice">Checking admin session…</section>;
    }

    if (isAuthenticated) {
        return <>{renderChildren()}</>;
    }

    return (
        <div className="app-frame app-frame--single">
            <main className="page-shell">
                <section className="panel admin-login-panel">
                    <div className="admin-login-panel__header">
                        <p className="eyebrow">Admin Access</p>
                        <h1>Config Center Login</h1>
                        <p className="hero-panel__copy">
                            Sign in as <code>admin</code> to access private
                            provider configuration and test routes.
                        </p>
                    </div>
                    {error ? (
                        <section className="notice notice--error">
                            {error}
                        </section>
                    ) : null}
                    <div className="admin-login-panel__form">
                        <label>
                            Username
                            <input
                                value={username}
                                onChange={(event) =>
                                    setUsername(event.target.value)
                                }
                            />
                        </label>
                        <label>
                            Password
                            <input
                                type="password"
                                value={password}
                                onChange={(event) =>
                                    setPassword(event.target.value)
                                }
                            />
                        </label>
                        <button
                            type="button"
                            onClick={submitLogin}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? "Signing in…" : "Sign In"}
                        </button>
                    </div>
                </section>
            </main>
        </div>
    );
}

function ConfigCenterWorkspace(props: {
    adminSession?: {
        username: string;
        onLogout: () => Promise<void>;
    };
}) {
    const [channels, setChannels] = useState(initialConfig.channels);
    const [models, setModels] = useState(initialConfig.models);
    const [priorities, setPriorities] = useState(initialConfig.priorities);
    const [frontendSettings, setFrontendSettings] = useState(
        initialConfig.frontendSettings ?? defaultFrontendSettings,
    );
    const [exportPreview, setExportPreview] = useState("");
    const [lastSavedConfigJson, setLastSavedConfigJson] = useState(() =>
        exportConfig(initialConfig),
    );
    const [isLoadingConfig, setIsLoadingConfig] = useState(true);
    const [isSavingConfig, setIsSavingConfig] = useState(false);
    const [loadError, setLoadError] = useState("");
    const [saveError, setSaveError] = useState("");

    const updateModel = (modelId: string, updater: ModelConfigUpdate) => {
        setModels((current) =>
            current.map((model) =>
                model.id === modelId ? { ...model, ...updater } : model,
            ),
        );
    };

    const removeModel = (modelId: string) => {
        setModels((current) => current.filter((model) => model.id !== modelId));
        setPriorities((current) =>
            current.filter((priority) => priority.modelId !== modelId),
        );
    };

    const removeChannel = (channelId: string) => {
        const removedModelIds = models
            .filter((model) => model.channelId === channelId)
            .map((model) => model.id);

        setChannels((current) =>
            current.filter((channel) => channel.id !== channelId),
        );
        setModels((current) =>
            current.filter((model) => model.channelId !== channelId),
        );
        setPriorities((current) =>
            current.filter(
                (priority) => !removedModelIds.includes(priority.modelId),
            ),
        );
    };

    const addModelToChannel = (channelId: string, modelName: string) => {
        const nextModelName = modelName.trim();
        if (!nextModelName) {
            return;
        }

        setModels((current) => [
            ...current,
            {
                ...createEmptyModelConfig(channelId),
                displayName: nextModelName,
                providerModelName: nextModelName,
            },
        ]);
    };

    const config = useMemo(
        () => ({
            version: 1 as const,
            channels,
            models,
            priorities,
            frontendSettings,
        }),
        [channels, models, priorities, frontendSettings],
    );

    const validation = validateConfig(config);
    const channelErrorSummary = Object.values(
        validation.channelFieldErrors,
    ).flat();
    const issueCount =
        validation.fieldErrors.length +
        channelErrorSummary.length +
        validation.sectionErrors.length +
        validation.globalErrors.length;
    const resolvedGroups = buildResolvedGroups(channels, models, priorities);
    const enabledChannelCount = channels.filter(
        (channel) => channel.enabled,
    ).length;
    const enabledModelCount = models.filter((model) => model.enabled).length;
    const currentConfigJson = exportConfig(config);
    const hasUnsavedChanges = currentConfigJson !== lastSavedConfigJson;
    const saveState = isLoadingConfig
        ? "Loading"
        : isSavingConfig
          ? "Saving"
          : saveError
            ? "Save failed"
            : !validation.canSave
              ? "Validation failed"
              : hasUnsavedChanges
                ? "Unsaved changes"
                : "Saved";
    const disableSave =
        isLoadingConfig ||
        isSavingConfig ||
        !validation.canSave ||
        !hasUnsavedChanges;

    useEffect(() => {
        writeStoredConfigPackJson(currentConfigJson);
    }, [currentConfigJson]);

    useEffect(() => {
        const normalizedPriorities = prioritiesFromResolvedGroups(resolvedGroups);
        const currentPriorityJson = JSON.stringify(
            priorities
                .filter((priority) =>
                    models.some((model) => model.id === priority.modelId),
                )
                .sort((left, right) => left.modelId.localeCompare(right.modelId)),
        );
        const normalizedPriorityJson = JSON.stringify(
            normalizedPriorities
                .slice()
                .sort((left, right) => left.modelId.localeCompare(right.modelId)),
        );

        if (currentPriorityJson !== normalizedPriorityJson) {
            setPriorities(normalizedPriorities);
        }
    }, [models, priorities, resolvedGroups]);

    useEffect(() => {
        const controller = new AbortController();

        async function loadConfig() {
            setIsLoadingConfig(true);
            setLoadError("");

            try {
                const response = await fetch("/v1/config/upstreams", {
                    signal: controller.signal,
                });

                if (!response.ok) {
                    throw new Error(await readGatewayErrorMessage(response));
                }

                const loadedConfig =
                    await readJsonResponse<typeof config>(response);
                const loadedConfigJson = exportConfig(loadedConfig);

                setChannels(loadedConfig.channels);
                setModels(loadedConfig.models);
                setPriorities(loadedConfig.priorities);
                setFrontendSettings(
                    loadedConfig.frontendSettings ?? defaultFrontendSettings,
                );
                setLastSavedConfigJson(loadedConfigJson);
            } catch (error) {
                if (!controller.signal.aborted) {
                    setLoadError(
                        error instanceof Error
                            ? error.message
                            : "Failed to load upstream config.",
                    );
                }
            } finally {
                if (!controller.signal.aborted) {
                    setIsLoadingConfig(false);
                }
            }
        }

        void loadConfig();

        return () => controller.abort();
    }, []);

    const saveConfig = async () => {
        if (!validation.canSave || isSavingConfig) {
            return;
        }

        setIsSavingConfig(true);
        setSaveError("");

        try {
            const response = await fetch("/v1/config/upstreams", {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                },
                body: currentConfigJson,
            });

            if (!response.ok) {
                throw new Error(await readGatewayErrorMessage(response));
            }

            const savedConfig = await readJsonResponse<typeof config>(response);
            const savedConfigJson = exportConfig(savedConfig);

            setChannels(savedConfig.channels);
            setModels(savedConfig.models);
            setPriorities(savedConfig.priorities);
            setFrontendSettings(
                savedConfig.frontendSettings ?? defaultFrontendSettings,
            );
            setLastSavedConfigJson(savedConfigJson);
            setExportPreview(savedConfigJson);
        } catch (error) {
            setSaveError(
                error instanceof Error
                    ? error.message
                    : "Failed to save upstream config.",
            );
        } finally {
            setIsSavingConfig(false);
        }
    };

    return (
        <div className="app-shell">
            <SidebarNav
                title="Config Center"
                subtitle="Private Admin Workspace"
                issueCount={issueCount}
                channelCount={channels.length}
                modelCount={models.length}
                routeGroupCount={resolvedGroups.length}
                testableModelCount={models.length}
                actions={props.adminSession ? (
                    <button
                        type="button"
                        className="section-nav__button"
                        onClick={() => {
                            void props.adminSession?.onLogout();
                        }}
                    >
                        Sign Out {props.adminSession.username}
                    </button>
                ) : null}
            />
            <main className="page-shell page-shell--wide">
                <section className="hero-panel hero-panel--workspace">
                    <div>
                        <p className="eyebrow">AI image routing cockpit</p>
                        <h1>Upstream Config Center</h1>
                        <p className="hero-panel__copy">
                            Configure providers, map public model names, and
                            control routing priority with immediate runtime
                            activation after save.
                        </p>
                    </div>
                    <div className="hero-panel__orb" aria-hidden="true" />
                </section>

                <ActionBar
                    saveState={saveState}
                    onAddChannel={() =>
                        setChannels((current) => [
                            ...current,
                            createEmptyChannelConfig(),
                        ])
                    }
                    onAddModel={() =>
                        setModels((current) => [
                            ...current,
                            createEmptyModelConfig(
                                channels.at(-1)?.id ?? channels[0]?.id ?? "",
                            ),
                        ])
                    }
                    onValidate={() => {}}
                    onSave={saveConfig}
                    onExport={() => setExportPreview(exportConfig(config))}
                    disableAddModel={channels.length === 0}
                    disableValidate
                    disableExport={false}
                    disableSave={disableSave}
                />

                <div className="workspace-grid">
                    <div className="workspace-grid__main">
                        <DraftStateBar
                            saveState={saveState}
                            hasUnsavedChanges={hasUnsavedChanges}
                            isLoadingConfig={isLoadingConfig}
                            isSavingConfig={isSavingConfig}
                            loadError={loadError}
                            saveError={saveError}
                            issueCount={issueCount}
                            validationCanSave={validation.canSave}
                        />

                        <section className="settings-section settings-section--summary">
                            <div className="settings-section__intro">
                                <p className="settings-section__eyebrow">
                                    Runtime Snapshot
                                </p>
                                <h2>Overview</h2>
                                <p>
                                    Track enabled providers, routed models, and
                                    validation pressure before you publish the
                                    current draft.
                                </p>
                            </div>
                            <OverviewCards
                                channelCount={channels.length}
                                enabledChannelCount={enabledChannelCount}
                                modelCount={models.length}
                                enabledModelCount={enabledModelCount}
                                routeGroupCount={resolvedGroups.length}
                                issueCount={issueCount}
                            />
                        </section>

                        {loadError ? (
                            <section className="notice notice--warning">
                                Backend config load unavailable: {loadError}.
                                The page is showing a local draft.
                            </section>
                        ) : null}
                        {saveError ? (
                            <section className="notice notice--error">
                                Save failed: {saveError}
                            </section>
                        ) : null}
                        <section className="settings-section">
                            <div className="settings-section__intro">
                                <p className="settings-section__eyebrow">
                                    Guardrails
                                </p>
                                <h2>Validation & Rules</h2>
                                <p>
                                    Keep protocol selection, duplicate model
                                    naming, and priority ordering within the
                                    backend acceptance rules.
                                </p>
                            </div>
                            <GlobalValidationSummary
                                fieldErrors={[
                                    ...validation.fieldErrors,
                                    ...channelErrorSummary,
                                ]}
                                globalErrors={validation.globalErrors}
                                sectionErrors={validation.sectionErrors}
                            />
                        </section>

                        <section className="settings-section">
                            <div className="settings-section__intro">
                                <p className="settings-section__eyebrow">
                                    Public UI
                                </p>
                                <h2>Invocation Studio Display</h2>
                                <p>
                                    Control whether the public invocation page
                                    exposes provider/channel details or uses a
                                    compact model-only workflow.
                                </p>
                            </div>
                            <section className="panel public-ui-settings">
                                <label className="public-ui-settings__toggle">
                                    <input
                                        type="checkbox"
                                        checked={
                                            frontendSettings.invocationStudio
                                                .minimalMode
                                        }
                                        onChange={(event) =>
                                            setFrontendSettings((current) => ({
                                                ...current,
                                                invocationStudio: {
                                                    ...current.invocationStudio,
                                                    minimalMode:
                                                        event.target.checked,
                                                },
                                            }))
                                        }
                                    />
                                    <span>
                                        <strong>
                                            Enable minimal Invocation Studio
                                        </strong>
                                        <small>
                                            Public users only choose a model.
                                            Provider, protocol, internal model
                                            ID, and helper notes are hidden.
                                        </small>
                                    </span>
                                </label>
                            </section>
                        </section>

                        <section className="settings-section">
                            <div className="settings-section__intro">
                                <p className="settings-section__eyebrow">
                                    Provider Setup
                                </p>
                                <h2>Channels</h2>
                                <p>
                                    Configure upstream credentials, protocol
                                    family, compatibility switches, and scoped
                                    provider models in one place.
                                </p>
                            </div>
                            <ChannelCardList
                                channels={channels}
                                models={models}
                                channelFieldErrors={
                                    validation.channelFieldErrors
                                }
                                onDeleteChannel={removeChannel}
                                onAddModel={addModelToChannel}
                                onModelChange={updateModel}
                                onDeleteModel={removeModel}
                                onChange={(channelId, next) =>
                                    setChannels((current) =>
                                        current.map((channel) =>
                                            channel.id === channelId
                                                ? next
                                                : channel,
                                        ),
                                    )
                                }
                            />
                        </section>

                        <section className="settings-section">
                            <div className="settings-section__intro">
                                <p className="settings-section__eyebrow">
                                    Registry
                                </p>
                                <h2>Models</h2>
                                <p>
                                    Audit routing names, upstream model IDs, and
                                    channel binding, then drag providers into
                                    the order each public model should use.
                                </p>
                            </div>
                            <ModelRegistryTable
                                models={models}
                                channels={channels}
                                groups={resolvedGroups}
                                onChange={updateModel}
                                onDelete={removeModel}
                                onReorderGroup={(
                                    displayName,
                                    sourceModelId,
                                    targetModelId,
                                ) =>
                                    setPriorities((current) =>
                                        reorderResolvedGroup(
                                            buildResolvedGroups(
                                                channels,
                                                models,
                                                current,
                                            ),
                                            displayName,
                                            sourceModelId,
                                            targetModelId,
                                        ),
                                    )
                                }
                            />
                        </section>

                        <section className="settings-section">
                            <div className="settings-section__intro">
                                <p className="settings-section__eyebrow">
                                    Verification
                                </p>
                                <h2>Provider Test Bench</h2>
                                <p>
                                    Run a real upstream image request against
                                    the current draft before saving
                                    compatibility changes.
                                </p>
                            </div>
                            <ProviderTestBench
                                config={config}
                                channels={channels}
                                models={models}
                            />
                        </section>
                        {exportPreview ? (
                            <section className="settings-section">
                                <div className="settings-section__intro">
                                    <p className="settings-section__eyebrow">
                                        Artifact
                                    </p>
                                    <h2>Export Preview</h2>
                                    <p>
                                        Review the exact JSON payload that the
                                        backend will load from runtime config
                                        storage.
                                    </p>
                                </div>
                                <section
                                    id="export"
                                    className="panel export-preview"
                                >
                                    <p
                                        className={`export-preview__status ${validation.canSave ? "is-valid" : "is-invalid"}`}
                                    >
                                        {validation.canSave
                                            ? "Export is ready for backend loading."
                                            : "Export contains validation errors and may be rejected by the backend."}
                                    </p>
                                    <label>
                                        Export JSON Preview
                                        <textarea
                                            aria-label="Export JSON Preview"
                                            readOnly
                                            value={exportPreview}
                                        />
                                    </label>
                                </section>
                            </section>
                        ) : null}
                    </div>
                </div>
            </main>
        </div>
    );
}

async function readGatewayErrorMessage(response: Response): Promise<string> {
    try {
        const payload = (await response.json()) as {
            error?: {
                message?: string;
            };
        };

        return (
            payload.error?.message ??
            `Request failed with status ${response.status}`
        );
    } catch {
        return `Request failed with status ${response.status}`;
    }
}

async function readJsonResponse<T>(response: Response): Promise<T> {
    const contentType = response.headers.get("content-type") ?? "";

    if (!contentType.includes("application/json")) {
        throw new Error(
            `Expected JSON from backend but received '${contentType || "unknown content type"}'.`,
        );
    }

    return (await response.json()) as T;
}
