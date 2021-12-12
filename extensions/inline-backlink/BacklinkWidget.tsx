import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { useEditorManagerContext } from '@bangle.io/editor-manager-context';
import { naukarWorkerProxy } from '@bangle.io/naukar-proxy';
import type { HighlightTextType, SearchMatch } from '@bangle.io/search-pm-node';
import {
  ButtonIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  Sidebar,
} from '@bangle.io/ui-components';
import {
  removeMdExtension,
  safeCancelIdleCallback,
  safeRequestIdleCallback,
  useClickToNote,
} from '@bangle.io/utils';
import { useWorkspaceContext } from '@bangle.io/workspace-context';
import { resolvePath } from '@bangle.io/ws-path';

const IconStyle = {
  height: 16,
  width: 16,
};

interface BacklinkSearchResult {
  wsPath: string;
  matches: Array<SearchMatch>;
}

export function BacklinkWidget() {
  const backlinkSearchResult = useBacklinkSearch();
  const { pushWsPath } = useWorkspaceContext();
  const makeOnClick = useClickToNote(pushWsPath);
  const [openedItems, updateOpenedItems] = useState(() => new Set<string>());
  const isCollapsed = useCallback(
    (r: BacklinkSearchResult) => {
      return !openedItems.has(r.wsPath);
    },
    [openedItems],
  );

  return (
    <div className="inline-backlink_widget-container flex flex-col">
      {!backlinkSearchResult || backlinkSearchResult.length === 0 ? (
        <span>
          🐒 No backlinks found!
          <br />
          <span className="font-light">
            Create one by typing <kbd className="font-normal">[[</kbd> followed
            by the name of the note.
          </span>
        </span>
      ) : (
        backlinkSearchResult.map((r, i) => {
          return (
            <React.Fragment key={i}>
              <Sidebar.Row2
                titleClassName=""
                className={'rounded text-sm truncate py-1 select-none'}
                extraInfoClassName="ml-1 text-sm"
                onClick={makeOnClick(r.wsPath)}
                item={{
                  uid: r.wsPath,
                  showDividerAbove: false,
                  title: resolvePath(r.wsPath).fileNameWithoutExt,
                  leftNode: (
                    <ButtonIcon
                      onClick={(e) => {
                        updateOpenedItems((items) => {
                          if (items.has(r.wsPath)) {
                            const clone = new Set(items);
                            clone.delete(r.wsPath);
                            return clone;
                          } else {
                            const clone = new Set(items);
                            clone.add(r.wsPath);
                            return clone;
                          }
                        });
                        e.stopPropagation();
                        e.preventDefault();
                      }}
                    >
                      {isCollapsed(r) ? (
                        <ChevronRightIcon style={IconStyle} />
                      ) : (
                        <ChevronDownIcon style={IconStyle} />
                      )}
                    </ButtonIcon>
                  ),
                  rightNode: (
                    <ButtonIcon className="text-xs font-semibold rounded inline-backlink_widget-occurrence-count">
                      {r.matches.length}
                    </ButtonIcon>
                  ),
                  rightHoverNode: (
                    <ButtonIcon className="text-xs font-semibold rounded inline-backlink_widget-occurrence-count">
                      {r.matches.length}
                    </ButtonIcon>
                  ),
                }}
              />
              {!isCollapsed(r) &&
                r.matches.map((matchObj, j) => (
                  <Sidebar.Row2
                    key={j}
                    className={
                      'search-result-text-match ml-1 pl-3 rounded ' +
                      (j === 0 ? 'mt-0' : 'mt-1')
                    }
                    onClick={makeOnClick(r.wsPath)}
                    titleClassName="text-sm "
                    item={{
                      uid: 'search-result-text-match-' + j,
                      title: <HighlightText highlightText={matchObj.match} />,
                    }}
                  ></Sidebar.Row2>
                ))}
            </React.Fragment>
          );
        })
      )}
    </div>
  );
}

function useBacklinkSearch(): BacklinkSearchResult[] | undefined {
  const { focusedEditorId } = useEditorManagerContext();
  const { wsName, openedWsPaths } = useWorkspaceContext();
  const [results, updateResults] = useState<BacklinkSearchResult[] | undefined>(
    undefined,
  );

  const calculateResult = useCallback(
    (focusedWsPath: string, controller: AbortController) => {
      if (!wsName) {
        return;
      }

      naukarWorkerProxy
        .abortableSearchWsForPmNode(controller.signal, wsName, 'backlink:*', [
          {
            nodeName: 'wikiLink',
            dataAttrName: 'path',
            printBefore: '[[',
            printAfter: ']]',
            queryIdentifier: 'backlink:',
          },
        ])
        .then(
          (result) => {
            const fileName = removeMdExtension(
              resolvePath(focusedWsPath).fileName,
            );

            updateResults(
              result
                .map((r) => {
                  const newMatches = r.matches.filter((match) => {
                    const [, highlightTextMatch] = match.match;
                    if (highlightTextMatch) {
                      return highlightTextMatch.includes(fileName);
                    }
                    return false;
                  });

                  return {
                    wsPath: r.uid,
                    matches: newMatches,
                  };
                })
                .filter((r) => r.matches.length > 0),
            );
          },
          (error) => {
            if (error instanceof DOMException && error.name === 'AbortError') {
              return;
            }
            throw error;
          },
        );
    },
    [wsName],
  );

  const focusedWsPath = useMemo(() => {
    if (focusedEditorId != null) {
      return openedWsPaths.getByIndex(focusedEditorId);
    }
    return undefined;
  }, [openedWsPaths, focusedEditorId]);

  useEffect(() => {
    const controller = new AbortController();
    let cb =
      focusedWsPath &&
      safeRequestIdleCallback(
        () => {
          calculateResult(focusedWsPath, controller);
        },
        { timeout: 1000 },
      );

    return () => {
      controller.abort();
      if (cb) {
        safeCancelIdleCallback(cb);
      }
    };
  }, [focusedWsPath, wsName, calculateResult]);

  return results;
}

function HighlightText({
  highlightText,
}: {
  highlightText: HighlightTextType;
}) {
  return (
    <div className="highlight-text-container">
      {highlightText.map((t, i) => (
        <span key={i} className="highlight-text text-sm">
          {t}
        </span>
      ))}
    </div>
  );
}