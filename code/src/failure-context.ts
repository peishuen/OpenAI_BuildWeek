import { JSDOM } from "jsdom";

import {
    FailureContextSchema,
    type FailureContext,
} from "./repair";

const DEFAULT_DOM_SNAPSHOT_LIMIT = 6_000;

// describe raw information that a future Playwright runner will provide
type RawFailureContext = {
    selector: string;
    errorExcerpt: string;
    sourcePath: string;
    sourceLine: number;
    domSnapshot: string;
}

// cut text at a predictable length so output is always consistent
function truncateText(text: string, maximumLength: number) {
    return text.slice(0, maximumLength);
}

export function sanitizeDomSnapshot(
    dirtyHtml: string,
    maximumLength = DEFAULT_DOM_SNAPSHOT_LIMIT,
) {
    // create a temporary HTML document from the browser snapshot
    const dom = new JSDOM(`<body>${dirtyHtml}</body>`);
    const { document, NodeFilter } = dom.window;
    
    // remove tags that are not useful for finding a page control
    document.querySelectorAll("script, style, svg").forEach((element) => {
        element.remove();
    });

    // remove event-handler sttaributes such as onclick or onerror
    document.querySelectorAll("*").forEach((element) => {
        [...element.attributes].forEach((attribute) => {
        if (attribute.name.startsWith("on")) {
            element.removeAttribute(attribute.name);
        }
        });
    });

    // find HTML comments so they can be removed
    const commentWalker = document.createTreeWalker(
        document,
        NodeFilter.SHOW_COMMENT,
    );

    const comments: Comment[] = [];

    while (commentWalker.nextNode()) {
        comments.push(commentWalker.currentNode as Comment);
    }

    // remove every collected comment from the DOM
    comments.forEach((comment) => {
        comment.remove();
    });

    // return only clean body HTML, limited to a safe maximum length
    return truncateText(document.body.innerHTML.trim(), maximumLength);
}

// build one validated failure object for the future repair engine
export function createFailureContext(
    rawFailure: RawFailureContext,
): FailureContext {

    // clean and validate the data before returning it
    return FailureContextSchema.parse({
        ...rawFailure,
        errorExcerpt: truncateText(rawFailure.errorExcerpt, 1_000),
        domSnapshot: sanitizeDomSnapshot(rawFailure.domSnapshot),
    })
}