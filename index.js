// const cheerio = require('cheerio');

import parse, { HTMLElement } from 'node-html-parser';
import path from 'path';
import fs from 'fs/promises';
import pageData from './bookPageData/EKMA411603.json' assert { type: 'json' };
import express from 'express';
import { pathToFileURL } from 'url';
import { loginAndGetCookie } from './get-cookie'

let COOKIE = ""

async function downloadPage({bookCode, moduleCode, pageNumber = 1, cookie = ""}) {
    // console.log(moduleCode, pageNumber)
    try {
        const res = await fetch(`https://pustaka.ut.ac.id/reader/services/view.php?doc=${moduleCode}&format=jpg&subfolder=${bookCode}/&page=${pageNumber}`, {
            "headers": {
                "accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
                "accept-language": "en-GB,en-US;q=0.9,en;q=0.8,id;q=0.7",
                "priority": "i",
                "sec-ch-ua": "\"Google Chrome\";v=\"141\", \"Not?A_Brand\";v=\"8\", \"Chromium\";v=\"141\"",
                "sec-ch-ua-mobile": "?0", 
                "sec-ch-ua-platform": "\"macOS\"",
                "sec-fetch-dest": "image",
                "sec-fetch-mode": "no-cors",
                "sec-fetch-site": "same-origin",
                "cookie": cookie,
                "Referer": `https://pustaka.ut.ac.id/reader/index.php?modul=${moduleCode}`
            },
            "body": null,
            "method": "GET"
        });
    
        const contentType = res.headers.get('content-type') || '';

        if (contentType.startsWith('text/html')) {
            console.log(`Response is HTML, cancelled binary download.`);
            throw new Error('Response is HTML, cancelled binary download.');
        }

        const ext = (contentType.split('/')[1] || 'jpg').split(';')[0];
        const dir = path.join(process.cwd(), String(bookCode));
        await fs.mkdir(dir, { recursive: true });

        const filename = path.join(dir, `${bookCode}-page-${moduleCode}-${pageNumber}.${ext}`);
        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        await fs.writeFile(filename, buffer);
        console.log(`Saved ${filename}`, contentType);

        const base64 = buffer.toString('base64');
        // If you want a data URI instead, return 
        return `data:${contentType};base64,${base64}`;
    } catch (err) {
        
        console.log(err)
        return err
    }
}

async function getPages(moduleCode) {
    try {
        const res = await fetch(`https://pustaka.ut.ac.id/reader/index.php?modul=${moduleCode}`, {
            "headers": {
                "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
                "accept-language": "en-GB,en-US;q=0.9,en;q=0.8,id;q=0.7",
                "priority": "u=0, i",
                "sec-ch-ua": "\"Google Chrome\";v=\"141\", \"Not?A_Brand\";v=\"8\", \"Chromium\";v=\"141\"",
                "sec-ch-ua-mobile": "?0",
                "sec-ch-ua-platform": "\"macOS\"",
                "sec-fetch-dest": "document",
                "sec-fetch-mode": "navigate",
                "sec-fetch-site": "none",
                "sec-fetch-user": "?1",
                "upgrade-insecure-requests": "1",
                "cookie": COOKIE
            },
            "body": null,
            "method": "GET"
        });

        const pageHtml = await res.text();
        // const filename = path.join(process.cwd(), 'page.html');
        // await fs.writeFile(filename, pageHtml, 'utf8');

        return pageHtml
        
        // return { html: pageHtml, $ };
    } catch (err) {
        console.log(err);
    }
}

/**
 * accept html string
 * return parsed html object
 */
function parsePage(htmlString = "") {
    return parse(htmlString)
}

/**
 * accept parsed html object
 * return sidebar html object
 */
/**
 * Extracts sidebar content from a provided HTML element.
 *
 * @param {HTMLElement} htmlObj - The root DOM element (an HTMLElement) to extract the sidebar from.
 * @returns {HTMLElement} The sidebar's HTML content as a string (or an empty string if no sidebar is found).
 * @throws {TypeError} If `htmlObj` is not an instance of HTMLElement.
 */
function getSidebarContent(htmlObj) {
    const SIDEBAR_ELEMENT_TAGNAME = "nav"
    const [nav] = htmlObj.getElementsByTagName(SIDEBAR_ELEMENT_TAGNAME)
    
    return nav
}

/**
 * accept sidebar html object
 * return array of module
 * @param {HTMLElement} sidebarHtmlObj - The root DOM element (an HTMLElement) to extract the sidebar from.
 * @returns {Array} The sidebar's HTML content as a string (or an empty string if no sidebar is found).
 */
function getModuleListFromSidebarContent(sidebarHtmlObj) {
    // get all <a/> element
    const sidebarLinks = sidebarHtmlObj.getElementsByTagName('a')
    // map their href into array
    // const linksCount = sidebarLinks.length
    // console.log(sidebarLinks)
    const moduleUrls = sidebarLinks.map((item) => {
        const link = item.getAttribute('href')
        return link
    })
    // for (let i = 0; i < linksCount; i++) {
    //     if (sidebarLinks.item && typeof sidebarLinks.item === 'function') {
    //         const moduleUrl = sidebarLinks.item(i).getAttribute('href')
    //         moduleUrls.push(moduleUrl)
    //     }
    // }

    return moduleUrls
}

function getModuleNameFromUrl(moduleUrl = "") {
    const [_, module] = moduleUrl.split('&doc=')
    const [moduleName, extension] = module.split('.')
    // console.log(moduleUrl)
    return moduleName
}

async function getModulesUrlFromSidebar(moduleCode) {
    try {
        const htmlPage = await getPages(moduleCode)
        if (htmlPage) {
            const parsedPage = parsePage(htmlPage)
            const sidebarHtmlObject = getSidebarContent(parsedPage)
            const moduleUrls = getModuleListFromSidebarContent(sidebarHtmlObject)
            return moduleUrls

        }
    } catch(err) {
        console.log(err)
    }
}



function downloadPageFromModuleUrls(bookCode, moduleUrls = [], auth) {
    try {
        // run sequentially using an async IIFE so each downloadPage is awaited
        return (async () => {
            for (let idx = 0; idx < moduleUrls.length; idx++) {
            const moduleUrl = moduleUrls[idx]
            const firstModule = getModuleNameFromUrl(moduleUrl)

            const totalPages = (pageData[idx] && pageData[idx].totalPage) || 0
            for (let i = 1; i < totalPages; i++) {
                try {
                    const fileName = await downloadPage({
                    bookCode: bookCode,
                    moduleCode: firstModule,
                    cookie: COOKIE,
                    pageNumber: i
                    })
                    const t = await uploadFileToDrive({
                        auth,
                        filePath: fileName,
                        folderId: '1pu2Ljr1lQP7eD9sVO7UL0y-WNPfiSXNG'
                    })
                    console.log(t)
                } catch (err) {
                    console.log(err)
                    break
                }
            }
            }
        })()
    } catch (err) {
        console.log(err)
    }
}

async function makeMyLifeEasier(bookCode) {
    try {
        const auth = await authFromServiceAccount(path.resolve(process.cwd(), './auth.json'))
        const moduleUrls = await getModulesUrlFromSidebar(bookCode)
        downloadPageFromModuleUrls(bookCode, moduleUrls.slice(2), auth)
    } catch(err) {
        console.log(err)
    }
}



// downloadAllPage()
const app = express();
app.use(express.json());

app.post('/set-cookie', (req, res) => {
    const cookie = req.body && req.body.cookie;
    if (!cookie) return res.status(400).json({ error: 'cookie field required in JSON body' });
    COOKIE = String(cookie);
    res.json({ ok: true, cookie: COOKIE });
});

app.get('/get-book-detail', async (req, res) => {
    try {
        const fileParam = req.query.file || req.query.bookCode;
        if (!fileParam) return res.status(400).json({ error: 'file or filename query param required' });

        const baseName = path.basename(String(fileParam), path.extname(String(fileParam)));
        const absPath = path.resolve(process.cwd(), 'bookPageData', `${baseName}.json`);
        const moduleUrl = pathToFileURL(absPath).href;

        let mod;
        try {
            // try import with JSON assertion (Node 17+ with --experimental-json-modules or native support)
            mod = await import(moduleUrl, { assert: { type: 'json' } });
        } catch (e) {
            // fallback to plain dynamic import if assertion not supported
            mod = await import(moduleUrl);
        }

        const data = mod && (mod.default ?? mod);
        if (!data) return res.status(404).json({ error: 'file not found or empty' });
        res.json(data);
    } catch (err) {
        if (err && (err.code === 'ERR_MODULE_NOT_FOUND' || err.code === 'ENOENT')) {
            return res.status(404).json({ error: 'file not found' });
        }
        res.status(500).json({ error: err.message || String(err) });
    }
});





// extract cache-check into helper and call it
        async function getCachedPageBase64(bookCode, moduleCode, pageNumber, extension = 'jpeg') {
            try {
            const dir = path.join(process.cwd(), String(bookCode));
            const cachedFile = path.join(dir, `${bookCode}-page-${moduleCode}-${pageNumber}.${extension}`);
            try {
                const fileBuf = await fs.readFile(cachedFile);
                const base64 = fileBuf.toString('base64');
                return { base64, metadata: { bookCode, moduleCode, pageNumber, source: 'cache' } };
            } catch (readErr) {
                if (readErr && readErr.code !== 'ENOENT') console.error('Failed to read cached file:', readErr);
                return null;
            }
            } catch (err) {
            console.error('Cache check error:', err);
            return null;
            }
        }

// Route: download a single page
// Example: GET /download-page?bookCode=EKMA4116&moduleCode=abcd1234&pageNumber=1
app.get('/download-page', async (req, res) => {
    try {
        const { bookCode, moduleCode, pageNumber = '1' } = req.query;
        if (!bookCode || !moduleCode) {
            return res.status(400).json({ error: 'bookCode and moduleCode are required' });
        }

        if (!COOKIE) {
            COOKIE = await loginAndGetCookie()
        }

        const cached = await getCachedPageBase64(bookCode, moduleCode, pageNumber);
        if (cached) return res.json(cached);
        
        const downloadResult = await downloadPage({
            bookCode,
            moduleCode,
            cookie: COOKIE,
            pageNumber
        })

        if (!(downloadResult instanceof Error)) {
            const base64 = downloadResult
            res.json({ base64, metadata: { bookCode, moduleCode, pageNumber, cookie: COOKIE, source: 'fetch' } });
        } else {
            const errorMessage = downloadResult
            throw Error(errorMessage)
        }

    } catch (err) {
        res.status(500).json({ error: err.message || String(err) });
    }
});


// Start server
const PORT = 3001;
app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});



// n8n -> server -> download semua gambar
