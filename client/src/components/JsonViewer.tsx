import React, {
    CSSProperties,
    ReactNode,
    useEffect,
    useState
} from "react";
import JsonView from '@uiw/react-json-view';
import { useSearchParams } from "react-router-dom";
import { Box } from "@mui/material";
import VersionNavigator from "./VersionNavigator.js";
import { AxiosInstance } from 'axios';
import { useSnackbar } from '../contexts/SnackbarContext.js';

function JsonViewer({ api, didArg, refresh } : { api: AxiosInstance, didArg?: string, refresh?: number }) {
    const [aliasDocs, setAliasDocs] = useState<any | undefined>(undefined);
    const [aliasDocsVersion, setAliasDocsVersion] = useState<number>(1);
    const [aliasDocsVersionMax, setAliasDocsVersionMax] = useState<number>(1);
    const [currentDid, setCurrentDid] = useState<string>("");
    const { showSnackbar } = useSnackbar();
    const [searchParams, setSearchParams] = useSearchParams();

    function handleClickDid(did: string) {
        setSearchParams({ did });
    }

    async function resolveDID(did: string) {
        setAliasDocs(undefined);
        setCurrentDid("");

        if (!did || did.trim() === "") {
            return;
        }

        try {
            const result: any = await api.get(`/did/${did}`);
            const docsData = result.data.docs;

            if (!docsData || !docsData.didDocumentMetadata) {
                showSnackbar("Invalid DID", "error");
                return;
            }
            const versions = docsData.didDocumentMetadata.version;

            setAliasDocs(docsData);
            if (versions) {
                setAliasDocsVersion(versions);
                setAliasDocsVersionMax(versions);
            } else {
                setAliasDocsVersion(1);
                setAliasDocsVersionMax(1);
            }

            setCurrentDid(did);
        } catch (error: any) {
            showSnackbar("Invalid DID", "error");
        }
    }

    useEffect(() => {
        if (didArg && didArg.trim() !== "") {
            resolveDID(didArg);
        } else {
            setAliasDocs(undefined);
            setCurrentDid("");
            setAliasDocsVersion(1);
            setAliasDocsVersionMax(1);
        }
    }, [didArg, refresh]);

    useEffect(() => {
        const didParam = searchParams.get('did');
        if (didParam) {
            resolveDID(didParam);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]);

    async function selectAliasDocsVersion(version: number) {
        try {
            setAliasDocsVersion(version);

            const result: any = await api.get(`/did/${currentDid}`, {
                params: {
                    atVersion: version
                }
            });
            setAliasDocs(result.data.docs);
        } catch (error: any) {
            console.error(error);
        }
    }

    return (
        <Box>
            {aliasDocs && (
                <Box>
                    {aliasDocsVersionMax > 1 &&
                        <Box sx={{ mt: 1 }}>
                            <VersionNavigator
                                version={aliasDocsVersion}
                                maxVersion={aliasDocsVersionMax}
                                onVersionChange={selectAliasDocsVersion}
                            />
                        </Box>
                    }
                    <Box sx={{ mt: 2 }}>
                        <JsonView
                            value={aliasDocs}
                            shortenTextAfterLength={0}
                        >
                            <JsonView.String
                                render={(
                                    viewRenderProps: {
                                        children?: ReactNode;
                                        style?: CSSProperties;
                                        [key: string]: any;
                                    },
                                    nodeInfo: {
                                        value?: unknown;
                                        type: "type" | "value";
                                        keyName?: string | number;
                                    }
                                ) => {
                                    const { children, style, ...rest } = viewRenderProps;
                                    const { value, type, keyName } = nodeInfo;

                                    if (typeof value === 'string' && value.startsWith('did:') && type === 'value') {
                                        return (
                                            <span
                                                {...rest}
                                                style={{ ...style, color: 'blue', textDecoration: 'underline', cursor: 'pointer' }}
                                                onClick={() => handleClickDid(value)}
                                            >
                                                {children}
                                            </span>
                                        );
                                    }

                                    if (type === 'value' &&
                                        aliasDocs?.didDocumentMetadata?.timestamp?.chain === "TBTC"
                                    ) {
                                        const currentKeyString = String(keyName);
                                        let url = '';

                                        if (currentKeyString === 'blockid') {
                                            url = `https://mempool.space/testnet4/block/${value}`;
                                        } else if (currentKeyString === 'txid') {
                                            url = `https://mempool.space/testnet4/tx/${value}`;
                                        }

                                        if (url) {
                                            return (
                                                <a
                                                    href={url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    style={{ ...style, color: 'blue', textDecoration: 'underline', cursor: 'pointer' }}
                                                >
                                                    {children}
                                                </a>
                                            );
                                        }
                                    }

                                    return undefined;
                                }}
                            />
                        </JsonView>
                    </Box>
                </Box>
            )}
        </Box>
    );
}

export default JsonViewer;
