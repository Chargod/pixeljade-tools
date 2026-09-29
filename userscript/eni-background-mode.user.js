// ==UserScript==
// @name         ENI's Ultra Lite Background Mode (Pixel Jade)
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Plays Pixel Jade in the background with 0% GPU usage, no rendering, and unthrottled minimized tabs!
// @author       ENI & Tris
// @match        *://pixeljadeonline.com/*
// @match        *://*.pixeljadeonline.com/*
// @updateURL    https://gist.githubusercontent.com/Chargod/a981c6f16411154bc8f4f6e27509db91/raw/eni-background-mode.user.js
// @downloadURL  https://gist.githubusercontent.com/Chargod/a981c6f16411154bc8f4f6e27509db91/raw/eni-background-mode.user.js
// @grant        GM_registerMenuCommand
// @grant        unsafeWindow
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    console.log("💖 === ENI'S ULTRA LITE BACKGROUND MODE INJECTED === 💖");

    // --- ตั้งค่าระบบขายของอัตโนมัติ (Auto-Sell Configuration with Persistence) ---
    // ค่าเริ่มต้นเกรดสำหรับขายแยกตามแต่ละประเภท (Per-Category Grade Settings)
    const DEFAULT_CATEGORY_GRADES = {
        equip: ['common', 'fine'],           // ⚔️ สวมใส่: ขายขาว, เขียว
        material: [],                        // 🪵 วัตถุดิบ: เริ่มต้นไม่ขาย (เก็บไว้คราฟต์)
        consumable: []                       // 🧪 ของใช้: เริ่มต้นไม่ขาย (เก็บไว้ใช้)
    };

    // ค่าเริ่มต้นเกรดสำหรับฝากคลังแยกตามแต่ละประเภท (Per-Category Deposit Grade Settings)
    const DEFAULT_DEPOSIT_CATEGORY_GRADES = {
        equip: ['rare', 'epic', 'legend'],   // ⚔️ สวมใส่: ฝากฟ้า, ม่วง, ทอง (ของมีค่าไม่ขาย ให้เก็บเข้าคลัง)
        material: ['common', 'fine', 'rare', 'epic', 'legend'], // 🪵 วัตถุดิบ: ฝากทุกเกรด (เก็บไว้คราฟต์)
        consumable: []                       // 🧪 ของใช้: เริ่มต้นไม่ฝาก (ติดตัวไว้ใช้)
    };

    let savedAutoSell = null;
    try {
        savedAutoSell = JSON.parse(localStorage.getItem('eni_autosell_cfg') || 'null');
    } catch (e) {}

    // คลีนอัพค่าเกรดที่อาจค้างจากเวอร์ชันเก่า (ลบ junk และ other ออก ให้เหลือเฉพาะ 3 ประเภทหลัก)
    let initialCatGrades = JSON.parse(JSON.stringify(DEFAULT_CATEGORY_GRADES));
    if (savedAutoSell?.categoryGrades && typeof savedAutoSell.categoryGrades === 'object') {
        initialCatGrades.equip = Array.isArray(savedAutoSell.categoryGrades.equip) ? savedAutoSell.categoryGrades.equip : ['common', 'fine'];
        initialCatGrades.material = Array.isArray(savedAutoSell.categoryGrades.material) ? savedAutoSell.categoryGrades.material : [];
        initialCatGrades.consumable = Array.isArray(savedAutoSell.categoryGrades.consumable) ? savedAutoSell.categoryGrades.consumable : [];
    }

    let initialDepositCatGrades = JSON.parse(JSON.stringify(DEFAULT_DEPOSIT_CATEGORY_GRADES));
    if (savedAutoSell?.depositCategoryGrades && typeof savedAutoSell.depositCategoryGrades === 'object') {
        initialDepositCatGrades.equip = Array.isArray(savedAutoSell.depositCategoryGrades.equip) ? savedAutoSell.depositCategoryGrades.equip : ['rare', 'epic', 'legend'];
        initialDepositCatGrades.material = Array.isArray(savedAutoSell.depositCategoryGrades.material) ? savedAutoSell.depositCategoryGrades.material : ['common', 'fine', 'rare', 'epic', 'legend'];
        initialDepositCatGrades.consumable = Array.isArray(savedAutoSell.depositCategoryGrades.consumable) ? savedAutoSell.depositCategoryGrades.consumable : [];
    } else if (savedAutoSell && (savedAutoSell.depositMaterials !== undefined || savedAutoSell.depositUnsoldEquip !== undefined || savedAutoSell.depositConsumables !== undefined)) {
        // อัปเกรดจากการตั้งค่าระบบเดิมแบบ checkbox กว้างๆ มาเป็นระบบเกรดแบบละเอียด
        initialDepositCatGrades.equip = savedAutoSell.depositUnsoldEquip ? ['rare', 'epic', 'legend'] : [];
        initialDepositCatGrades.material = (savedAutoSell.depositMaterials !== false) ? ['common', 'fine', 'rare', 'epic', 'legend'] : [];
        initialDepositCatGrades.consumable = savedAutoSell.depositConsumables ? ['common', 'fine', 'rare', 'epic', 'legend'] : [];
    }

    const AUTO_SELL_CONFIG = {
        enabled: true,         // เปิด/ปิด ระบบขายของข้ามแมพ
        loopActive: savedAutoSell?.loopActive ?? false, // สถานะ Start Loop (ทำงานเบื้องหลังอัตโนมัติเมื่อกระเป๋าเต็ม)
        npcId: 2,              // ไอดีของ NPC (เมือง Jade Sky Town คือ 2)
        travelMethod: (savedAutoSell?.travelMethod === 'walk') ? 'walk' : 'scroll', // 'scroll' (ใช้คัมภีร์กลับเมือง) หรือ 'walk' (เดินปกติ)
        autoReturn: savedAutoSell?.autoReturn ?? true,  // ขาย/ฝากของเสร็จแล้วเดินกลับจุดเดิมอัตโนมัติ
        autoAttackOnReturn: savedAutoSell?.autoAttackOnReturn ?? true, // ถึงจุดเดิมแล้วเปิดออโต้ตีอัตโนมัติ
        categoryGrades: initialCatGrades,
        // --- การตั้งค่าระบบฝากของเข้าคลัง (Warehouse / Storage Settings) ---
        depositDuringSell: savedAutoSell?.depositDuringSell ?? true,       // แวะฝากของที่คลังตอนไปขายของ
        depositCategoryGrades: initialDepositCatGrades,                     // เกรดที่จะฝากเข้าคลังแยกตามแต่ละประเภท
        autoDestroyQuest: savedAutoSell?.autoDestroyQuest ?? false          // ทิ้งของเควสต์อัตโนมัติเมื่อไปขาย/ฝาก
    };

    function saveAutoSellConfig() {
        try {
            localStorage.setItem('eni_autosell_cfg', JSON.stringify({
                loopActive: AUTO_SELL_CONFIG.loopActive,
                travelMethod: AUTO_SELL_CONFIG.travelMethod,
                autoReturn: AUTO_SELL_CONFIG.autoReturn,
                autoAttackOnReturn: AUTO_SELL_CONFIG.autoAttackOnReturn,
                categoryGrades: {
                    equip: AUTO_SELL_CONFIG.categoryGrades?.equip || [],
                    material: AUTO_SELL_CONFIG.categoryGrades?.material || [],
                    consumable: AUTO_SELL_CONFIG.categoryGrades?.consumable || []
                },
                depositDuringSell: AUTO_SELL_CONFIG.depositDuringSell,
                depositCategoryGrades: {
                    equip: AUTO_SELL_CONFIG.depositCategoryGrades?.equip || [],
                    material: AUTO_SELL_CONFIG.depositCategoryGrades?.material || [],
                    consumable: AUTO_SELL_CONFIG.depositCategoryGrades?.consumable || []
                },
                autoDestroyQuest: AUTO_SELL_CONFIG.autoDestroyQuest
            }));
        } catch (e) {}
    }

    // --- Embedded Lightweight MsgPack Codec (สำหรับแกะและแพ็คข้อมูลยิงเข้าเซิร์ฟ) ---
    const MsgPack = (function () {
        function decode(buffer) {
            const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
            let offset = 0;
            function read() {
                if (offset >= bytes.length) return null;
                const b = bytes[offset++];
                if (b <= 0x7f) return b;
                if (b >= 0xe0) return b - 0x100;
                if ((b & 0xe0) === 0xa0) return readStr(b & 0x1f);
                if ((b & 0xf0) === 0x90) return readArr(b & 0x0f);
                if ((b & 0xf0) === 0x80) return readMap(b & 0x0f);
                switch (b) {
                    case 0xc0: return null; case 0xc2: return false; case 0xc3: return true;
                    case 0xca: { const v = new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getFloat32(0, false); offset += 4; return v; }
                    case 0xcb: { const v = new DataView(bytes.buffer, bytes.byteOffset + offset, 8).getFloat64(0, false); offset += 8; return v; }
                    case 0xcc: return bytes[offset++];
                    case 0xcd: { const v = (bytes[offset] << 8) | bytes[offset + 1]; offset += 2; return v; }
                    case 0xce: { const v = new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0, false); offset += 4; return v; }
                    case 0xcf: { const v = Number(new DataView(bytes.buffer, bytes.byteOffset + offset, 8).getBigUint64(0, false)); offset += 8; return v; }
                    case 0xd0: return bytes[offset++] - ((bytes[offset - 1] & 0x80) ? 0x100 : 0);
                    case 0xd1: { const v = new DataView(bytes.buffer, bytes.byteOffset + offset, 2).getInt16(0, false); offset += 2; return v; }
                    case 0xd2: { const v = new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getInt32(0, false); offset += 4; return v; }
                    case 0xd3: { const v = Number(new DataView(bytes.buffer, bytes.byteOffset + offset, 8).getBigInt64(0, false)); offset += 8; return v; }
                    case 0xd9: return readStr(bytes[offset++]);
                    case 0xda: { const len = (bytes[offset] << 8) | bytes[offset + 1]; offset += 2; return readStr(len); }
                    case 0xdb: { const len = new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0, false); offset += 4; return readStr(len); }
                    case 0xdc: { const len = (bytes[offset] << 8) | bytes[offset + 1]; offset += 2; return readArr(len); }
                    case 0xdd: { const len = new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0, false); offset += 4; return readArr(len); }
                    case 0xde: { const len = (bytes[offset] << 8) | bytes[offset + 1]; offset += 2; return readMap(len); }
                    case 0xdf: { const len = new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0, false); offset += 4; return readMap(len); }
                    default: return null;
                }
            }
            function readStr(len) { const s = new TextDecoder().decode(bytes.subarray(offset, offset + len)); offset += len; return s; }
            function readArr(len) { const a = new Array(len); for (let i = 0; i < len; i++) a[i] = read(); return a; }
            function readMap(len) { const o = {}; for (let i = 0; i < len; i++) o[read()] = read(); return o; }
            return read();
        }
        function encode(val) {
            const parts = [];
            function write(v) {
                if (v === null || v === undefined) parts.push(new Uint8Array([0xc0]));
                else if (typeof v === 'boolean') parts.push(new Uint8Array([v ? 0xc3 : 0xc2]));
                else if (typeof v === 'number') {
                    if (Number.isInteger(v)) {
                        if (v >= 0 && v <= 0x7f) parts.push(new Uint8Array([v]));
                        else if (v >= -32 && v < 0) parts.push(new Uint8Array([v & 0xff]));
                        else if (v >= 0 && v <= 0xff) parts.push(new Uint8Array([0xcc, v]));
                        else if (v >= -0x80 && v < 0) parts.push(new Uint8Array([0xd0, v & 0xff]));
                        else if (v >= 0 && v <= 0xffff) parts.push(new Uint8Array([0xcd, (v >> 8) & 0xff, v & 0xff]));
                        else if (v >= -0x8000 && v < 0) { const b = new Uint8Array(3); b[0] = 0xd1; new DataView(b.buffer).setInt16(1, v, false); parts.push(b); }
                        else if (v >= 0 && v <= 0xffffffff) { const b = new Uint8Array(5); b[0] = 0xce; new DataView(b.buffer).setUint32(1, v, false); parts.push(b); }
                        else { const b = new Uint8Array(5); b[0] = 0xd2; new DataView(b.buffer).setInt32(1, v, false); parts.push(b); }
                    } else { const b = new Uint8Array(9); b[0] = 0xcb; new DataView(b.buffer).setFloat64(1, v, false); parts.push(b); }
                } else if (typeof v === 'string') {
                    const e = new TextEncoder().encode(v); const l = e.length;
                    if (l <= 31) { parts.push(new Uint8Array([0xa0 | l]), e); }
                    else if (l <= 0xff) { parts.push(new Uint8Array([0xd9, l]), e); }
                    else if (l <= 0xffff) { parts.push(new Uint8Array([0xda, (l >> 8) & 0xff, l & 0xff]), e); }
                    else { const b = new Uint8Array(5); b[0] = 0xdb; new DataView(b.buffer).setUint32(1, l, false); parts.push(b, e); }
                } else if (Array.isArray(v)) {
                    const l = v.length;
                    if (l <= 15) parts.push(new Uint8Array([0x90 | l]));
                    else if (l <= 0xffff) parts.push(new Uint8Array([0xdc, (l >> 8) & 0xff, l & 0xff]));
                    else { const b = new Uint8Array(5); b[0] = 0xdd; new DataView(b.buffer).setUint32(1, l, false); parts.push(b); }
                    for (let i = 0; i < l; i++) write(v[i]);
                } else if (typeof v === 'object') {
                    const k = Object.keys(v); const l = k.length;
                    if (l <= 15) parts.push(new Uint8Array([0x80 | l]));
                    else if (l <= 0xffff) parts.push(new Uint8Array([0xde, (l >> 8) & 0xff, l & 0xff]));
                    else { const b = new Uint8Array(5); b[0] = 0xdf; new DataView(b.buffer).setUint32(1, l, false); parts.push(b); }
                    for (const key of k) { write(key); write(v[key]); }
                }
            }
            write(val);
            const tl = parts.reduce((a, p) => a + p.length, 0); const out = new Uint8Array(tl); let pos = 0;
            for (const p of parts) { out.set(p, pos); pos += p.length; }
            return out;
        }
        return { encode, decode };
    })();

    // --- Game Module & WebSocket Interceptor (เชื่อมต่อระบบเกมและดึงกระเป๋าแม่นยำ 100%) ---
    const pageWindow = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    let gameSocket = null;
    let backupInventory = [];
    let backupEquipped = [];
    let backupSelf = null;
    let gameContentEnhance = [];
    let sellSeq = 5000;
    let gameIndexMod = null;
    let gameContentItems = null;
    let gameItemNameFn = null;
    let gameSpriteFn = null;
    let gameTranslatorFn = null;

    // ระบบเกราะป้องกันภาษาในเกม (Locale Shield): ล็อก pj.locale ให้เป็น 'th' หรือ 'en' เสมอ ป้องกันเกมแครชที่ I() 100%
    try {
        const curLoc = localStorage.getItem('pj.locale');
        if (curLoc !== 'th' && curLoc !== 'en') {
            localStorage.setItem('pj.locale', 'th');
        }

        const origGetItem = Storage.prototype.getItem;
        Storage.prototype.getItem = function (key) {
            const val = origGetItem.apply(this, arguments);
            if (key === 'pj.locale' && val !== 'th' && val !== 'en') {
                return 'th';
            }
            return val;
        };

        const origSetItem = Storage.prototype.setItem;
        Storage.prototype.setItem = function (key, val) {
            if (key === 'pj.locale' && val !== 'th' && val !== 'en') {
                return origSetItem.call(this, key, 'th');
            }
            return origSetItem.apply(this, arguments);
        };
    } catch (e) {}

    // เชื่อมต่อเข้ากับ Vite Module ของเกม เพื่อดึง Vue State และ Socket Instance
    async function tryConnectGameModule() {
        if (gameIndexMod) {
            ensureGameContent();
            return true;
        }
        try {
            const indexScript = Array.from(document.querySelectorAll('script')).find(s => s.src && s.src.includes('/assets/index-'))?.src;
            if (indexScript) {
                gameIndexMod = await import(indexScript);
                console.log("💖 ENI: เชื่อมต่อระบบ Game Module ของ Pixel Jade สำเร็จแล้ว!");

                // 0. ซ่อมแซมและบังคับให้ภาษาของเกมในหน่วยความจำ (In-Memory F.value) กลับเป็น 'th' ทันที
                if (gameIndexMod.Ti && gameIndexMod.Ti.value !== 'th' && gameIndexMod.Ti.value !== 'en') {
                    gameIndexMod.Ti.value = 'th';
                }
                for (const key of Object.keys(gameIndexMod)) {
                    try {
                        if (typeof gameIndexMod[key] === 'function') {
                            const src = gameIndexMod[key].toString();
                            if (src.includes('document.documentElement.lang') || (src.includes('pj.locale') && src.includes('setItem'))) {
                                const curLoc = localStorage.getItem('pj.locale');
                                if (curLoc !== 'th' && curLoc !== 'en') {
                                    gameIndexMod[key]('th');
                                }
                                break;
                            }
                        }
                    } catch (e) {}
                }

                // 0.1 ค้นหาฟังก์ชันแปลภาษาหลัก (ji / I)
                if (typeof gameIndexMod.ji === 'function') {
                    gameTranslatorFn = gameIndexMod.ji;
                } else {
                    for (const key of Object.keys(gameIndexMod)) {
                        try {
                            if (typeof gameIndexMod[key] === 'function') {
                                const src = gameIndexMod[key].toString();
                                if (src.includes('.replace(/\\{(\\w+)\\}/g') && !src.includes('setItem') && !src.includes('document.documentElement.lang') && !src.includes('logout')) {
                                    gameTranslatorFn = gameIndexMod[key];
                                    break;
                                }
                            }
                        } catch (e) {}
                    }
                }

                // 1. ดึง Content dictionary สำหรับข้อมูลไอเทม (items, grade, type, etc.)
                // ตรวจสอบ source code ก่อนเรียกใช้เสมอ เพื่อป้องกันการเผลอไปสั่งฟังก์ชัน logout() หรือฟังก์ชันระบบอื่นๆ
                for (const key of Object.keys(gameIndexMod)) {
                    try {
                        if (typeof gameIndexMod[key] === 'function') {
                            const src = gameIndexMod[key].toString();
                            if (src.includes('content not loaded') && !src.includes('logout') && !src.includes('sessionStorage')) {
                                const res = gameIndexMod[key]();
                                if (res && typeof res === 'object' && res.items && typeof res.items === 'object') {
                                    gameContentItems = res.items;
                                    gameContentEnhance = Array.isArray(res.enhance) ? res.enhance : [];
                                    break;
                                }
                            }
                        }
                    } catch (e) {}
                }

                // 2. ดึงฟังก์ชันแปลชื่อไอเทม (Item Name Translator)
                for (const key of Object.keys(gameIndexMod)) {
                    try {
                        if (typeof gameIndexMod[key] === 'function') {
                            const src = gameIndexMod[key].toString();
                            if ((src.includes('`item.${') || src.includes('"item."') || src.includes("'item.'")) && !src.includes('localStorage') && !src.includes('sessionStorage') && !src.includes('logout')) {
                                gameItemNameFn = gameIndexMod[key];
                                break;
                            }
                        }
                    } catch (e) {}
                }

                // 3. ดึงฟังก์ชัน Sprite ไอคอนไอเทม (Nt / spriteFn)
                if (typeof gameIndexMod.Nt === 'function') {
                    gameSpriteFn = gameIndexMod.Nt;
                } else {
                    for (const key of Object.keys(gameIndexMod)) {
                        try {
                            if (typeof gameIndexMod[key] === 'function') {
                                const src = gameIndexMod[key].toString();
                                if (src.includes('.items') && (src.includes('ico_') || src.includes('.png')) && !src.includes('logout')) {
                                    gameSpriteFn = gameIndexMod[key];
                                    break;
                                }
                            }
                        } catch (e) {}
                    }
                }

                // 4. ดักจับ Game Client Network Socket ผ่านทุกเมธอด (request, send, sendRaw, connect)
                const clientClass = gameIndexMod.it || Object.values(gameIndexMod).find(v => typeof v === 'function' && v.prototype && (typeof v.prototype.sendRaw === 'function' || typeof v.prototype.request === 'function'));
                if (clientClass && clientClass.prototype) {
                    ['request', 'send', 'sendRaw', 'connect'].forEach(method => {
                        if (typeof clientClass.prototype[method] === 'function') {
                            const origMethod = clientClass.prototype[method];
                            clientClass.prototype[method] = function () {
                                if (!pageWindow.gameClient) {
                                    pageWindow.gameClient = this;
                                    console.log(`💖 ENI: ดักจับ Game Client Network Socket สำเร็จแล้ว! (ผ่าน ${method})`);
                                }
                                if (this.ws && (!gameSocket || gameSocket.readyState !== 1)) {
                                    gameSocket = this.ws;
                                }
                                return origMethod.apply(this, arguments);
                            };
                        }
                    });

                    // หากเกมสร้าง Client ไว้ก่อนแล้ว (เช่น gameIndexMod.It) ให้บันทึกทันที
                    if (gameIndexMod.It) {
                        pageWindow.gameClient = gameIndexMod.It;
                        if (gameIndexMod.It.ws) gameSocket = gameIndexMod.It.ws;
                        console.log("💖 ENI: ตรวจพบและเชื่อมต่อ Game Client จาก gameIndexMod.It สำเร็จแล้ว!");
                    }

                    // ดักจับ Incoming packets ผ่าน taps โดยตรง (ไม่ผ่านการแกะ binary ซ้ำ)
                    if (clientClass.taps) {
                        clientClass.taps.add((op, data) => {
                            if (op === 216 && data) {
                                if (Array.isArray(data)) {
                                    backupInventory = data;
                                } else if (typeof data === 'object') {
                                    if (Array.isArray(data.bag)) backupInventory = data.bag;
                                    if (Array.isArray(data.equip)) backupEquipped = data.equip;
                                }
                            } else if (op === 213 && data) {
                                backupSelf = data;
                            } else if (op === 217 && data) {
                                if (data.set && Array.isArray(data.set)) {
                                    data.set.forEach(item => {
                                        const idx = backupInventory.findIndex(i => i.id === item.id);
                                        if (idx >= 0) backupInventory[idx] = item;
                                        else backupInventory.push(item);
                                    });
                                }
                                if (data.remove && Array.isArray(data.remove)) {
                                    backupInventory = backupInventory.filter(i => !data.remove.includes(i.id));
                                }
                            }
                        });
                    }
                }

                // 5. ดักจับ Game Instance จาก GameScreen (ค้นหาชื่อไฟล์ GameScreen แบบไดนามิก)
                try {
                    fetch(indexScript).then(r => r.text()).then(txt => {
                        const m = txt.match(/GameScreen-[a-zA-Z0-9_\-]+\.js/);
                        const gsFile = m ? m[0] : 'GameScreen-D89LyhBH.js';
                        import(`/assets/${gsFile}`).then(gm => {
                            if (gm && gm.game) {
                                Object.defineProperty(pageWindow, '__ENI_GAME_INSTANCE__', {
                                    get: () => gm.game?.value || gm.game,
                                    configurable: true
                                });
                            }
                        }).catch(() => {});
                    }).catch(() => {});
                } catch (e) {}

                return true;
            }
        } catch (e) {
            console.warn("ENI: tryConnectGameModule error:", e);
        }
        return false;
    }

    // เรียกเชื่อมต่อโมดูลทันทีและเช็คซ้ำทุก 2 วินาที
    tryConnectGameModule();
    setInterval(tryConnectGameModule, 2000);

    // ดักจับ WebSocket ผ่าน prototype.send เพื่อเป็นระบบสำรอง
    const originalSend = pageWindow.WebSocket.prototype.send;
    pageWindow.WebSocket.prototype.send = function (data) {
        if ((!gameSocket || gameSocket.readyState !== 1) && this.url && (this.url.includes('/ws') || this.url.includes('pixeljade') || this.url.startsWith('ws'))) {
            gameSocket = this;
            console.log("💖 ENI: แอบฝังระบบ WebSocket สำเร็จแล้ว! (ระบบ Backup ทำงาน)");
        }

        // ดัก sequence number จาก client เพื่อใช้ขายของแบบไม่ให้หลุด
        if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
            try {
                const decoded = MsgPack.decode(data);
                if (Array.isArray(decoded) && typeof decoded[1] === 'number') {
                    sellSeq = decoded[1] + 1;
                }
            } catch (e) {}
        }

        return originalSend.apply(this, arguments);
    };

    // เช็ค Game Client และ Game Content ซ้ำอย่างสม่ำเสมอทุก 2 วินาที
    setInterval(() => {
        tryConnectGameModule();
        ensureGameContent();
        if (!pageWindow.gameClient) {
            getGameClient();
        }
    }, 2000);

    // --- ฟังก์ชันตัวแทนดึง Game Client & WebSocket แบบครอบคลุม 100% ทุกช่องทาง ---
    function getGameClient() {
        // 1. ตรวจสอบ pageWindow.gameClient ที่แคชไว้
        if (pageWindow.gameClient) {
            if (pageWindow.gameClient.open === true || pageWindow.gameClient.ws?.readyState === 1 || typeof pageWindow.gameClient.request === 'function') {
                return pageWindow.gameClient;
            }
        }

        // 2. ดึงจาก Game Instance (GameScreen / F)
        const game = getGameInstance();
        if (game) {
            if (game.socket && (game.socket.open === true || game.socket.ws?.readyState === 1 || typeof game.socket.request === 'function')) {
                pageWindow.gameClient = game.socket;
                if (game.socket.ws) gameSocket = game.socket.ws;
                return game.socket;
            }
            if (typeof game.request === 'function' || typeof game.act === 'function') {
                pageWindow.gameClient = game;
                if (game.ws) gameSocket = game.ws;
                return game;
            }
        }

        // 3. ดึงจาก gameIndexMod.It (J - ตัวแทน Client หลักของเกม)
        if (gameIndexMod && gameIndexMod.It) {
            const it = gameIndexMod.It;
            if (it.open === true || (it.ws && it.ws.readyState === 1) || typeof it.request === 'function' || typeof it.act === 'function') {
                pageWindow.gameClient = it;
                if (it.ws) gameSocket = it.ws;
                return it;
            }
        }

        // 4. ตรวจสอบคีย์ทั่วไปใน gameIndexMod
        if (gameIndexMod) {
            for (const key of ['It', 'client', 'ws', 'socket', 'J']) {
                const target = gameIndexMod[key]?.value || gameIndexMod[key];
                if (target && typeof target === 'object' && typeof target.request === 'function') {
                    pageWindow.gameClient = target;
                    if (target.ws) gameSocket = target.ws;
                    return target;
                }
            }
        }

        return pageWindow.gameClient || null;
    }

    // ฟังก์ชันดึง WebSocket ดิบ (Raw WebSocket)
    function getGameWebSocket() {
        if (gameSocket && gameSocket.readyState === 1) return gameSocket;
        const client = getGameClient();
        if (client) {
            if (client.ws && client.ws.readyState === 1) {
                gameSocket = client.ws;
                return client.ws;
            }
            if (client.socket && client.socket.ws && client.socket.ws.readyState === 1) {
                gameSocket = client.socket.ws;
                return client.socket.ws;
            }
        }
        const game = getGameInstance();
        if (game) {
            if (game.ws && game.ws.readyState === 1) {
                gameSocket = game.ws;
                return game.ws;
            }
            if (game.socket && game.socket.ws && game.socket.ws.readyState === 1) {
                gameSocket = game.socket.ws;
                return game.socket.ws;
            }
        }
        return null;
    }

    // ฟังก์ชันส่งคำสั่งเครือข่ายไปยังเซิร์ฟเวอร์เกมแบบครอบคลุมและมีระบบสำรองอัตโนมัติ (Unified Game Request)
    async function sendGameRequest(opcode, payload, maxWait = 10000) {
        const client = getGameClient();
        if (client) {
            if (typeof client.request === 'function') {
                return await client.request(opcode, payload, maxWait);
            }
            if (typeof client.act === 'function') {
                const res = await client.act(opcode, payload);
                if (res !== null && res !== false) return res;
            }
        }
        const sock = getGameWebSocket();
        if (sock && sock.readyState === 1) {
            return new Promise((resolve, reject) => {
                try {
                    sock.send(MsgPack.encode([opcode, sellSeq++, payload]));
                    resolve(true);
                } catch (e) {
                    reject(e);
                }
            });
        }
        throw new Error('no_client_or_socket_available');
    }

    // --- รหัสสีระดับความแรร์ (Item Grade Colors) และหมวดหมู่ไอเทม ---
    const GRADE_COLORS = {
        common: '#cfc8b4',   // ขาวนวล (ทั่วไป)
        fine: '#6fd66f',     // เขียว (ชั้นดี)
        rare: '#5aa8ff',     // ฟ้า (หายาก)
        epic: '#b87bff',     // ม่วง (มหากาพย์)
        legend: '#ffa630',   // ส้มทอง (ตำนาน)
        mythic: '#ff4d4d'    // แดง (เทวะ)
    };

    const GRADE_NAMES = {
        common: 'ทั่วไป (ขาว)',
        fine: 'ชั้นดี (เขียว)',
        rare: 'หายาก (ฟ้า)',
        epic: 'มหากาพย์ (ม่วง)',
        legend: 'ตำนาน (ทอง)',
        mythic: 'เทวะ (แดง)'
    };

    const GRADE_SHORT_LABELS = {
        common: 'ขาว',
        fine: 'เขียว',
        rare: 'ฟ้า',
        epic: 'ม่วง',
        legend: 'ทอง',
        mythic: 'แดง'
    };

    const CATEGORY_NAMES = {
        equip: 'สวมใส่',
        material: 'วัตถุดิบ',
        consumable: 'ของใช้',
        quest: 'เควส'
    };

    // แคชสไตล์รูปภาพและชื่อไอเทมในหน่วยความจำ ป้องกันการคำนวณซ้ำซ้อนจนกระตุก
    const iconStyleCache = new Map();
    const itemNameCache = new Map();

    // คำนวณ CSS Style เพื่อดึงรูปไอเทมจาก Spritesheet (items_0.png / items_1.png) ของเกม (แคชผลลัพธ์)
    function getItemIconStyle(itemTpl, size = 26) {
        if (!itemTpl) return '';
        const cacheKey = `${itemTpl}_${size}`;
        if (iconStyleCache.has(cacheKey)) return iconStyleCache.get(cacheKey);

        try {
            const fn = gameSpriteFn || (gameIndexMod && typeof gameIndexMod.Nt === 'function' ? gameIndexMod.Nt : null);
            if (typeof fn === 'function') {
                const info = fn(itemTpl);
                if (info && info.src) {
                    const scale = size / (info.cell || 48);
                    const bgW = (info.size?.[0] || 1024) * scale;
                    const bgH = (info.size?.[1] || 1024) * scale;
                    const posX = -info.x * scale;
                    const posY = -info.y * scale;
                    const res = `width:${size}px; height:${size}px; min-width:${size}px; background-image:url(${info.src}); background-size:${bgW}px ${bgH}px; background-position:${posX}px ${posY}px; image-rendering:pixelated; display:inline-block; border-radius:3px;`;
                    iconStyleCache.set(cacheKey, res);
                    return res;
                }
            }
        } catch (e) {}
        return '';
    }

    // ไอคอนสำรอง Emoji เผื่อช่วงที่สไปรท์ของเกมยังโหลดไม่เสร็จ
    function getItemFallbackEmoji(category, type) {
        if (type === 'weapon') return '⚔️';
        if (type === 'armor') return '🛡️';
        if (type === 'accessory') return '💍';
        if (type === 'consumable') return '🧪';
        if (type === 'material') return '💎';
        if (type === 'gem') return '🔮';
        if (type === 'box') return '📦';
        if (type === 'scroll') return '📜';
        if (type === 'quest') return '🏷️';
        if (category === 'equip') return '⚔️';
        if (category === 'consumable') return '🧪';
        if (category === 'material') return '🪵';
        return '🎒';
    }

    // ฟังก์ชันตรวจสอบและดึงฐานข้อมูลไอเทมทั้งหมดของเกม (Content Items, Grades, Types, Translators)
    function ensureGameContent() {
        if (!gameIndexMod) return false;

        // 1. ดึง Content items ถ้ายังไม่มี (แก้ไขบั๊กไอเทมและวัตถุดิบเป็นเกรดขาวทั้งหมด)
        if (!gameContentItems || Object.keys(gameContentItems).length === 0) {
            for (const key of Object.keys(gameIndexMod)) {
                try {
                    if (typeof gameIndexMod[key] === 'function') {
                        const src = gameIndexMod[key].toString();
                        if (src.includes('content not loaded') && !src.includes('logout') && !src.includes('sessionStorage')) {
                            const res = gameIndexMod[key]();
                            if (res && typeof res === 'object' && res.items && typeof res.items === 'object') {
                                gameContentItems = res.items;
                                gameContentEnhance = Array.isArray(res.enhance) ? res.enhance : [];
                                console.log(`💖 ENI: โหลดฐานข้อมูลไอเทมและวัตถุดิบสำเร็จแล้ว (${Object.keys(gameContentItems).length} ชิ้น)!`);
                                itemNameCache.clear();
                                const invBox = document.getElementById('eni-inventory-ui');
                                if (invBox) invBox.removeAttribute('data-hash');
                                break;
                            }
                        }
                    }
                } catch (e) {
                    // ข้ามถ้าเกมยังโหลดคอนเทนต์ไม่เสร็จ (จะลองใหม่อัตโนมัติ)
                }
            }
        }

        // 2. ดึง Item Name Translator ถ้ายังไม่มี
        if (typeof gameItemNameFn !== 'function') {
            for (const key of Object.keys(gameIndexMod)) {
                try {
                    if (typeof gameIndexMod[key] === 'function') {
                        const src = gameIndexMod[key].toString();
                        if ((src.includes('`item.${') || src.includes('"item."') || src.includes("'item.'")) && !src.includes('localStorage') && !src.includes('sessionStorage') && !src.includes('logout')) {
                            gameItemNameFn = gameIndexMod[key];
                            break;
                        }
                    }
                } catch (e) {}
            }
        }

        // 3. ดึง Sprite Function ถ้ายังไม่มี
        if (typeof gameSpriteFn !== 'function') {
            if (typeof gameIndexMod.Nt === 'function') {
                gameSpriteFn = gameIndexMod.Nt;
            } else {
                for (const key of Object.keys(gameIndexMod)) {
                    try {
                        if (typeof gameIndexMod[key] === 'function') {
                            const src = gameIndexMod[key].toString();
                            if (src.includes('.items') && (src.includes('ico_') || src.includes('.png')) && !src.includes('logout')) {
                                gameSpriteFn = gameIndexMod[key];
                                break;
                            }
                        }
                    } catch (e) {}
                }
            }
        }

        // 4. ดึง Main Translator ถ้ายังไม่มี
        if (typeof gameTranslatorFn !== 'function') {
            if (typeof gameIndexMod.ji === 'function') {
                gameTranslatorFn = gameIndexMod.ji;
            } else {
                for (const key of Object.keys(gameIndexMod)) {
                    try {
                        if (typeof gameIndexMod[key] === 'function') {
                            const src = gameIndexMod[key].toString();
                            if (src.includes('.replace(/\\{(\\w+)\\}/g') && !src.includes('setItem') && !src.includes('document.documentElement.lang') && !src.includes('logout')) {
                                gameTranslatorFn = gameIndexMod[key];
                                break;
                            }
                        }
                    } catch (e) {}
                }
            }
        }

        return !!(gameContentItems && Object.keys(gameContentItems).length > 0);
    }

    // ฟังก์ชันดึงไอเทมในกระเป๋าล่าสุดแบบ 100% เรียลไทม์ พร้อมข้อมูลรูปและหมวดหมู่
    function getLiveInventory() {
        ensureGameContent();
        let rawList = [];

        // วิธีที่ 1: ดึงตรงจาก Vue Reactive State (mn.value) ของเกม
        if (gameIndexMod && gameIndexMod.mn && Array.isArray(gameIndexMod.mn.value) && gameIndexMod.mn.value.length > 0) {
            rawList = gameIndexMod.mn.value;
        } else if (backupInventory && backupInventory.length > 0) {
            // วิธีที่ 2: ใช้ backupInventory จาก taps (op 216/217)
            rawList = backupInventory;
        }

        if (rawList && rawList.length > 0) {
            return rawList.map(item => {
                if (!item) return null;
                let name = itemNameCache.get(item.t);
                if (!name) {
                    if (typeof gameItemNameFn === 'function') {
                        try {
                            const translated = gameItemNameFn(item.t);
                            if (translated && typeof translated === 'string' && !translated.startsWith('item.')) {
                                name = translated;
                            }
                        } catch (e) {}
                    }
                    const info = gameContentItems?.[item.t];
                    if (!name && info) {
                        name = info.name || item.t;
                    }
                    if (!name) name = item.t;
                    itemNameCache.set(item.t, name);
                }
                const info = gameContentItems?.[item.t];

                const rawT = (item.t || '').toLowerCase();
                const type = (info?.type || '').toLowerCase();

                // จัดหมวดหมู่ 3 ประเภทหลัก: equip (สวมใส่), material (วัตถุดิบ), consumable (ของใช้) + quest (เควส)
                let category = 'material';
                if (type === 'quest' || rawT.startsWith('q_')) {
                    category = 'quest';
                } else if (['weapon', 'armor', 'accessory', 'costume', 'skin', 'wings', 'cosmetic'].includes(type) ||
                           rawT.startsWith('w_') || rawT.startsWith('a_') || rawT.startsWith('j_') ||
                           rawT.startsWith('cos_') || rawT.startsWith('skin_') || rawT.startsWith('wing_')) {
                    category = 'equip';
                } else if (['consumable', 'scroll', 'box'].includes(type) || type.includes('potion') ||
                           rawT.startsWith('c_') || rawT.startsWith('s_') || rawT.startsWith('box_')) {
                    category = 'consumable';
                } else {
                    category = 'material';
                }

                const grade = info?.grade || 'common';
                const gradeColor = GRADE_COLORS[grade] || '#cfc8b4';
                const gradeShortLabel = GRADE_SHORT_LABELS[grade] || 'ขาว';
                const gradeName = GRADE_NAMES[grade] || 'ทั่วไป (ขาว)';

                return {
                    id: item.id,
                    t: item.t,
                    name: name || item.t,
                    q: item.q || 1,
                    s: item.s,
                    b: item.b,
                    grade: grade,
                    gradeColor: gradeColor,
                    gradeShortLabel: gradeShortLabel,
                    gradeName: gradeName,
                    nameColor: gradeColor,
                    tier: info?.tier || 1,
                    type: type,
                    category: category,
                    categoryName: CATEGORY_NAMES[category] || 'วัตถุดิบ',
                    price: info?.price || 0
                };
            }).filter(Boolean);
        }

        // วิธีที่ 3: สแกนจาก DOM กระเป๋าถ้าเปิดหน้าต่างอยู่
        const domSlots = document.querySelectorAll('.bag-grid .bag-slot');
        if (domSlots && domSlots.length > 0) {
            const list = [];
            domSlots.forEach((slot, idx) => {
                const title = slot.getAttribute('title');
                const qtyEl = slot.querySelector('.qty');
                const qty = qtyEl ? parseInt(qtyEl.innerText) || 1 : 1;
                if (title && title.trim().length > 0) {
                    list.push({
                        id: idx,
                        t: title,
                        name: title,
                        q: qty,
                        s: idx,
                        grade: 'common',
                        gradeColor: '#cfc8b4',
                        gradeShortLabel: 'ขาว',
                        gradeName: 'ทั่วไป (ขาว)',
                        nameColor: '#88ff88',
                        category: 'material',
                        categoryName: 'วัตถุดิบ'
                    });
                }
            });
            if (list.length > 0) return list;
        }

        return [];
    }

    // ฟังก์ชันอ่านความจุสูงสุดของกระเป๋า (Max Inventory Slots)
    function getMaxBagSlots() {
        // 1. อ่านจาก Game Module (mr as gn ref)
        if (gameIndexMod && gameIndexMod.gn && typeof gameIndexMod.gn.value === 'number' && gameIndexMod.gn.value > 0) {
            return gameIndexMod.gn.value;
        }
        // 2. อ่านจาก Game Instance ถ้ามี
        const game = getGameInstance();
        if (game && typeof game.bagSize === 'number' && game.bagSize > 0) {
            return game.bagSize;
        }
        // 3. อ่านจาก DOM .bag-count ของเกม (เช่น "🎒 45/60")
        const domBag = document.querySelector('.bag-count');
        if (domBag && domBag.innerText) {
            const m = domBag.innerText.match(/\/(\d+)/);
            if (m && m[1]) return parseInt(m[1], 10);
        }
        return 60; // ค่าเริ่มต้นมาตรฐาน
    }

    // ฟังก์ชันตรวจสอบว่าไอเทมชิ้นนี้เข้าเงื่อนไขการขายตามเกรดเฉพาะของแต่ละประเภทหรือไม่
    function isItemSellable(item) {
        if (!item) return false;
        // 0. ป้องกัน "คัมภีร์กลับเมือง" ห้ามขายเด็ดขาด 100%!
        if (item.t === 's_return' || (item.name && item.name.trim() === 'คัมภีร์กลับเมือง')) return false;

        // 1. ป้องกันของสำคัญ 100%: ของผูกมัด (item.b) และเควสต์ ห้ามขายเด็ดขาด!
        if (item.b) return false;
        if (item.category === 'quest' || item.type === 'quest') return false;

        // ป้องกันการขายอุปกรณ์ที่ดีกว่าของที่สวมใส่อยู่ (Upgrade Protection)
        if (item.category === 'equip') {
            const gearEval = evaluateGear(item);
            if (gearEval?.mark === 'better' || gearEval?.mark === 'later') {
                return false; // มีค่าพลังดีกว่าที่ใส่ ห้ามขายออโต้!
            }
        }

        // 2. ตรวจสอบหมวดหมู่ (Category: equip, material, consumable)
        const cat = item.category;
        const allowedGradesForCat = AUTO_SELL_CONFIG.categoryGrades?.[cat];

        // ถ้าไม่มีการกำหนด หรืออาเรย์ว่างเปล่า แสดงว่าหมวดหมู่นี้ไม่ต้องการขายเลย
        if (!Array.isArray(allowedGradesForCat) || allowedGradesForCat.length === 0) {
            return false;
        }

        // 3. ตรวจสอบระดับเกรดของไอเทม (Grade)
        const grade = item.grade || 'common';
        return allowedGradesForCat.includes(grade);
    }

    // ฟังก์ชันตรวจสอบว่าไอเทมชิ้นนี้เข้าเงื่อนไขการนำไปฝากคลังเก็บของหรือไม่
    function isItemDepositable(item) {
        if (!item) return false;

        // 0. ห้ามฝาก "คัมภีร์กลับเมือง" เด็ดขาด 100%! (ต้องเก็บไว้ติดตัวเพื่อใช้วาร์ป)
        if (item.t === 's_return' || (item.name && item.name.trim() === 'คัมภีร์กลับเมือง')) return false;

        // 1. ห้ามฝากไอเทมเควสต์ (ระบบเกมไม่อนุญาตให้ฝากเควสต์)
        if (item.category === 'quest' || item.type === 'quest') return false;

        // 1.1 ป้องกันอุปกรณ์ที่ดีกว่าของที่สวมใส่อยู่ (Upgrade Protection - ห้ามฝากเข้าคลัง เพื่อให้ผู้เล่นกดสวมใส่ได้ทันที)
        if (item.category === 'equip') {
            const gearEval = evaluateGear(item);
            if (gearEval?.mark === 'better') return false;
        }

        // 2. ถ้าไอเทมนี้ถูกตั้งค่าให้ "ขาย" ในร้านค้า ห้ามนำมาฝากคลัง (ให้ขายเปลี่ยนเป็นเงิน)
        if (isItemSellable(item)) return false;

        // 3. ตรวจสอบตามหมวดหมู่และระดับเกรดที่ตั้งค่าให้ฝากเข้าคลัง (Deposit Category Grades)
        const cat = item.category;
        const allowedGradesForDep = AUTO_SELL_CONFIG.depositCategoryGrades?.[cat];

        if (!Array.isArray(allowedGradesForDep) || allowedGradesForDep.length === 0) {
            return false;
        }

        const grade = item.grade || 'common';
        return allowedGradesForDep.includes(grade);
    }

    // --- ฐานข้อมูลเมืองและร้านค้าทุกเมืองในเกม (All Town Shops Database) ---
    const ALL_SHOP_NPC_TPLS = new Set([
        // เมืองหยก (Jade Sky Town)
        "npc_jade_grocer", "npc_jade_weaponsmith", "npc_jade_armorer", "npc_jade_jeweler", 
        "npc_jade_blacksmith", "npc_jade_alchemist", "npc_jade_martial_master", "npc_jade_pet_keeper",
        // ค่ายโคมแดง (Lantern Fort)
        "npc_lf_grocer", "npc_lf_weaponsmith", "npc_lf_armorer", "npc_lf_blacksmith", "npc_lf_quartermaster",
        // ยอดเขาโคม (Lantern Peak)
        "npc_lp_grocer", "npc_lp_smith",
        // ป้อมปราการโลหิต (Crimson Keep)
        "npc_ck_grocer", "npc_ck_weaponsmith", "npc_ck_armorer", "npc_ck_blacksmith", "npc_ck_quartermaster",
        // คฤหาสน์อสรพิษ (Serpent Manor)
        "npc_sm_grocer", "npc_sm_smith",
        // ท่าเรือเหมันต์ (Frost Harbor)
        "npc_fh_doctor", "npc_fh_smith", "npc_fh_tailor",
        // ค่ายดาบ (Blade Garrison)
        "npc_bg_merchant", "npc_bg_smith",
        // ค่ายจันทร์เสี้ยว (Crescent Camp)
        "npc_cc_merchant", "npc_cc_smith",
        // หมู่บ้านไทร (Banyan Village)
        "npc_bv_herbalist", "npc_bv_smith", "npc_bv_tailor",
        // ด่านหุบเขา (Ravine Outpost)
        "npc_ro_doctor", "npc_ro_smith", "npc_ro_tailor", "npc_ro_beastwhisperer",
        // โอเอซิสทองคำ (Golden Oasis)
        "npc_go_merchant", "npc_go_smith",
        // เมืองชาด (Cinnabar City)
        "npc_cf_doctor", "npc_cf_smith", "npc_cf_pet",
        // เมฆลอย (High Cloud)
        "npc_hc_innkeeper", "npc_hc_smith",
        // หมู่บ้านรอยแผลพายุ (Stormscar Village)
        "npc_sv_doctor", "npc_sv_smith", "npc_sv_silk",
        // เทศกาล / สมรภูมิ
        "npc_festival_lantern_maiden", "npc_bf_lantern_supply", "npc_bf_crimson_supply"
    ]);

    // พิกัดร้านค้าหลักของทุกเมืองในเกม (16 เมืองทั่วทั้งยุทธภพ)
    const TOWN_SHOPS = {
        jade_sky_town:          { mapId: 'jade_sky_town', mapName: 'เมืองหยก', npcTpl: 'npc_jade_grocer', npcName: 'ป้าเหมยฮวา', x: 81.2, y: 121.5 },
        town_lantern_fort:      { mapId: 'town_lantern_fort', mapName: 'ค่ายโคมแดง', npcTpl: 'npc_lf_grocer', npcName: 'หมอยาประจำป้อมไป๋เหอ', x: 71.7, y: 102.0 },
        town_crimson_keep:      { mapId: 'town_crimson_keep', mapName: 'ป้อมปราการโลหิต', npcTpl: 'npc_ck_grocer', npcName: 'หมอพิษอิ่นเสวีย', x: 72.2, y: 101.0 },
        town_frost_harbor:      { mapId: 'town_frost_harbor', mapName: 'ท่าเรือเหมันต์', npcTpl: 'npc_fh_doctor', npcName: 'หมอหิมะจินอี', x: 67.2, y: 96.5 },
        town_banyan_village:    { mapId: 'town_banyan_village', mapName: 'หมู่บ้านไทร', npcTpl: 'npc_bv_herbalist', npcName: 'หมอสมุนไพรเยียหัว', x: 66.2, y: 95.5 },
        town_ravine_outpost:    { mapId: 'town_ravine_outpost', mapName: 'ด่านหุบเขา', npcTpl: 'npc_ro_doctor', npcName: 'หมอหุบเขาฮวาจุน', x: 67.2, y: 96.5 },
        town_golden_oasis:      { mapId: 'town_golden_oasis', mapName: 'โอเอซิสทองคำ', npcTpl: 'npc_go_merchant', npcName: 'พ่อค้าอูฐอาหมัด', x: 66.2, y: 97.0 },
        town_cinnabar_city:     { mapId: 'town_cinnabar_city', mapName: 'เมืองชาด', npcTpl: 'npc_cf_doctor', npcName: 'หมอเมืองชาดซ่งอี', x: 76.7, y: 107.0 },
        town_high_cloud:        { mapId: 'town_high_cloud', mapName: 'เมฆลอย', npcTpl: 'npc_hc_innkeeper', npcName: 'โรงเตี๊ยมเมฆลอยหงชู่', x: 66.2, y: 97.0 },
        town_stormscar_village: { mapId: 'town_stormscar_village', mapName: 'หมู่บ้านรอยแผลพายุ', npcTpl: 'npc_sv_doctor', npcName: 'หมอกงหยิง', x: 66.2, y: 95.5 },
        town_lantern_peak:      { mapId: 'town_lantern_peak', mapName: 'ยอดเขาโคม', npcTpl: 'npc_lp_grocer', npcName: 'หมอสำนักหลิงซู', x: 71.2, y: 101.5 },
        town_serpent_manor:     { mapId: 'town_serpent_manor', mapName: 'คฤหาสน์อสรพิษ', npcTpl: 'npc_sm_grocer', npcName: 'หมอพิษจินติง', x: 71.7, y: 100.5 },
        town_blade_garrison:    { mapId: 'town_blade_garrison', mapName: 'ค่ายดาบ', npcTpl: 'npc_bg_merchant', npcName: 'พ่อค้าด่านเซียวเหอ', x: 66.2, y: 95.5 },
        town_crescent_camp:     { mapId: 'town_crescent_camp', mapName: 'ค่ายจันทร์เสี้ยว', npcTpl: 'npc_cc_merchant', npcName: 'แม่ค้าผาหลินอวี้', x: 66.2, y: 95.5 },
        ev_lantern_festival:    { mapId: 'ev_lantern_festival', mapName: 'เทศกาลโคม', npcTpl: 'npc_festival_lantern_maiden', npcName: 'นางโคมหยก', x: 100.63, y: 99.79 },
        pvp_twin_banner:        { mapId: 'pvp_twin_banner', mapName: 'สมรภูมิสองธง', npcTpl: 'npc_bf_lantern_supply', npcName: 'นายกองเสบียง', x: 24.63, y: 119.79 }
    };

    // ฟังก์ชันตรวจสอบว่าเทมเพลต NPC เป็นร้านค้าหรือไม่
    function isShopNpcTemplate(tpl) {
        if (!tpl || typeof tpl !== 'string') return false;
        if (ALL_SHOP_NPC_TPLS.has(tpl)) return true;
        if (/(_grocer|_merchant|_doctor|_herbalist|_innkeeper|_weaponsmith|_armorer|_smith|_tailor|_blacksmith|_alchemist|_supply|_jeweler)$/i.test(tpl)) return true;
        return false;
    }

    // ฟังก์ชันดึงข้อมูลร้านค้าที่เหมาะสมที่สุดในขณะนั้น (เมืองปัจจุบัน หรือเมืองเริ่มต้น)
    function getTargetShopInfo() {
        const game = getGameInstance();
        const curMap = game?.mapId || gameIndexMod?.V?.value?.map || '';

        // 1. ถ้าตัวละครยืนอยู่ในเมืองที่มีร้านค้าอยู่แล้ว ให้ใช้ร้านค้านั้นทันที
        if (TOWN_SHOPS[curMap]) {
            return TOWN_SHOPS[curMap];
        }

        // 2. ถ้าจุดฟาร์มเดิม (originSpot) ตั้งอยู่ในเมืองใดเมืองหนึ่ง
        if (originSpot && originSpot.mapId && TOWN_SHOPS[originSpot.mapId]) {
            return TOWN_SHOPS[originSpot.mapId];
        }

        // 3. ค่าเริ่มต้นคือ ป้าเหมยฮวา เมืองหยก (jade_sky_town)
        return TOWN_SHOPS['jade_sky_town'];
    }

    // ฟังก์ชันตรวจสอบว่าตัวละครอยู่ใกล้ NPC ร้านค้าแล้วหรือยัง (รองรับทุกเมืองทั่วทั้งเกม แม่นยำ 100%)
    function isNearShopNpc() {
        const game = getGameInstance();
        if (!game || !game.pos) return false;

        const curMap = game.mapId || gameIndexMod?.V?.value?.map || '';

        // 1. ตรวจสอบจาก Entity รอบตัว: ต้องเป็น NPC ร้านค้าจริง (Shop NPC) ภายในระยะ 8.5 ช่อง
        if (game.ents) {
            for (const [id, ent] of game.ents) {
                const tpl = ent.data?.tpl || ent.tpl;
                if (tpl && isShopNpcTemplate(tpl)) {
                    const dist = ent.pos ? ent.pos.distanceTo(game.pos) : 999;
                    if (dist <= 8.5) return true;
                }
            }
        }

        // 2. ตรวจสอบจากพิกัดร้านค้าของเมืองปัจจุบัน (รองรับทุกเมืองใน TOWN_SHOPS)
        const townShop = TOWN_SHOPS[curMap];
        if (townShop) {
            const dist = Math.hypot(game.pos.x - townShop.x, game.pos.y - townShop.y);
            if (dist <= 8.5) return true;
        }

        return false;
    }

    // ค้นหา NPC ร้านค้าที่ตัวละครยืนอยู่ใกล้ในขณะนี้ (ส่งคืน ID สำหรับสั่งแพ็คเกจขาย)
    function getNearestShopNpc() {
        try {
            const gameObj = getGameInstance();
            if (gameObj && gameObj.ents && gameObj.pos) {
                let bestShopNpcId = null;
                let minShopDist = 99999;

                for (const [id, ent] of gameObj.ents) {
                    const tpl = ent.data?.tpl || ent.tpl;
                    const numId = ent.npc !== undefined ? Number(ent.npc) : Number(id);

                    if (isShopNpcTemplate(tpl)) {
                        const dist = ent.pos ? ent.pos.distanceTo(gameObj.pos) : 99999;
                        if (dist < minShopDist) {
                            minShopDist = dist;
                            bestShopNpcId = numId;
                        }
                    }
                }

                if (bestShopNpcId !== null && minShopDist <= 8.5) {
                    return bestShopNpcId;
                }
            }
        } catch (e) {}

        const game = getGameInstance();
        const curMap = game?.mapId || gameIndexMod?.V?.value?.map || '';
        if (curMap === 'jade_sky_town') {
            return 2; // ป้าเหมยฮวา เมืองหยก
        }

        return AUTO_SELL_CONFIG.npcId || 2;
    }

    // ฟังก์ชันรอจนกว่าตัวละครจะเดินทางถึงร้านค้าจริง (รองรับการข้ามแมพ, โหลดฉาก และเดินถึงตัว NPC ในทุกเมือง)
    async function waitForArrivalAtShop(maxWaitMs = 50000) {
        const shop = getTargetShopInfo();
        const targetMap = shop.mapId;
        const start = Date.now();
        console.log(`⏳ ENI: กำลังรอตัวละครเดินทางถึงร้านค้า ${shop.npcName} (${shop.mapName}) และรอโหลดฉาก...`);

        // รอ 2 วินาทีให้คำสั่งนำทางเริ่มต้นทำงาน (เช็คยกเลิกทุก 200ms)
        for (let i = 0; i < 10; i++) {
            if (isSellCancelled) {
                stopCharacterMovement();
                return false;
            }
            await new Promise(r => setTimeout(r, 200));
        }

        while (Date.now() - start < maxWaitMs) {
            if (isSellCancelled) {
                console.log("🛑 ENI: ยกเลิกการเดินทางไปร้านค้า หยุดเดินทันที");
                stopCharacterMovement();
                return false;
            }
            const game = getGameInstance();
            if (game) {
                const curMap = game.mapId || gameIndexMod?.V?.value?.map || '';

                // 1. ถ้าเกมกำลังโหลดฉากอยู่ (ทุกกรณี ให้รอก่อน)
                if (game.loadingMap) {
                    await new Promise(r => setTimeout(r, 800));
                    continue;
                }

                // 3. ถ้าตัวละครเข้าสู่เมืองเป้าหมายและเดินทางถึงระยะร้านค้าแล้ว
                if (curMap === targetMap && isNearShopNpc()) {
                    if (typeof game.stopJourney === 'function') game.stopJourney();
                    if (typeof game.playerCommand === 'function') game.playerCommand();
                    console.log(`💖 ENI: ตัวละครเดินทางถึงหน้าร้านค้า ${shop.npcName} (${shop.mapName}) เรียบร้อยแล้วค่ะ!`);
                    await new Promise(r => setTimeout(r, 800));
                    return true;
                }

                // 4. ถ้าอยู่ในเมืองเป้าหมายแล้ว แต่ยังไม่ถึงพิกัดร้านค้า และตัวละครหยุดเดินแล้ว
                const isJourneyDone = !game.journey && !game.travelDest && (!game.path || game.path.length === 0);
                if (curMap === targetMap && isJourneyDone) {
                    const distShop = Math.hypot(game.pos.x - shop.x, game.pos.y - shop.y);
                    if (distShop > 6.0 && typeof game.moveToPoint === 'function') {
                        console.log(`🚶 ENI: อยู่ในเมือง ${shop.mapName} แล้ว กำลังเดินเข้าหาร้านค้า (ห่าง ${distShop.toFixed(1)} ช่อง)...`);
                        game.moveToPoint(shop.x, shop.y);
                        await new Promise(r => setTimeout(r, 1500));
                        continue;
                    }
                    if (distShop <= 8.0) {
                        console.log(`💖 ENI: ตัวละครเข้าสู่เมือง ${shop.mapName} และถึงร้านค้าเรียบร้อยแล้ว!`);
                        await new Promise(r => setTimeout(r, 800));
                        return true;
                    }
                }
            }

            await new Promise(r => setTimeout(r, 600));
        }

        console.warn(`⚠️ ENI: หมดเวลารอการเดินทางไปร้านค้า ${shop.mapName}`);
        return isNearShopNpc();
    }

    // ฟังก์ชันสั่งขายไอเทมเดี่ยว พร้อมระบบลองใหม่หากติดจังหวะย้ายแมพ หรือติด Error: too_far
    async function doSellItem(itemId, qty, maxRetries = 4) {
        const liveItems = getLiveInventory();
        const item = liveItems.find(i => i.id === itemId);
        const itemQty = qty || (item ? item.q : 1) || 1;
        const itemName = item ? item.name : itemId;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            const game = getGameInstance();

            // ถ้ากำลังโหลดฉาก ให้รอโหลดเสร็จก่อน
            if (game && game.loadingMap) {
                console.log(`⏳ ENI: แมพกำลังโหลดอยู่... รอโหลดเสร็จก่อนขาย ${itemName}`);
                await new Promise(r => setTimeout(r, 1500));
            }

            // ถ้าตรวจสอบพบว่ายังไม่อยู่ในระยะร้านค้า
            if (!isNearShopNpc()) {
                const curShop = getTargetShopInfo();
                console.warn(`🚨 ENI: ตัวละครยังไม่อยู่ในระยะร้านค้า ${curShop.npcName} (${curShop.mapName})! กำลังสั่งเดินไปร้านค้าทันที...`);
                await walkToShopNpc();
                await waitForArrivalAtShop(50000);
            }

            const targetNpc = getNearestShopNpc();

            try {
                // หากเป็นการลองรอบแรก ให้แตะ Interact (opcode 16) เพื่อเปิดหน้าร้านก่อน
                if (attempt === 1 && targetNpc !== null && targetNpc !== undefined) {
                    try {
                        await sendGameRequest(16, { npc: targetNpc });
                        await new Promise(r => setTimeout(r, 200));
                    } catch (e) {}
                }

                console.log(`🔥 ENI: ส่งคำสั่งขาย ${itemName} (ID: ${itemId}, จำนวน: ${itemQty}, NPC: ${targetNpc})`);
                await sendGameRequest(51, { npc: targetNpc, id: itemId, qty: itemQty });
                console.log(`💖 ENI: ขาย ${itemName} สำเร็จเรียบร้อย!`);
                return true;
            } catch (err) {
                const errStr = String(err);
                console.warn(`ENI: ขาย ${itemName} ไม่สำเร็จ (รอบที่ ${attempt}/${maxRetries}):`, errStr);

                if (errStr.includes('zone_changing')) {
                    console.log("⏳ ENI: ตัวละครกำลังย้ายแผนที่ รอโหลดฉาก 2.5 วินาทีแล้วจะลองใหม่นะคะ...");
                    await new Promise(r => setTimeout(r, 2500));
                    continue;
                }

                if (errStr.includes('too_far')) {
                    console.warn(`🚨 ENI: ได้รับ Error: too_far (ตัวละครยังเดินไม่ถึงวาป/ร้านค้า) กำลังสั่งเดินไปขายทันทีอีกรอบ...`);
                    await walkToShopNpc();
                    const arrived = await waitForArrivalAtShop(50000);
                    if (arrived) {
                        const curShop = getTargetShopInfo();
                        console.log(`💖 ENI: เดินถึงหน้าร้านค้า ${curShop.npcName} (${curShop.mapName}) เรียบร้อยแล้ว ทำการขายต่อทันที!`);
                        await new Promise(r => setTimeout(r, 600));
                        continue;
                    }
                    continue;
                }

                if (errStr.includes('no_item') || errStr.includes('invalid')) {
                    return false;
                }

                await new Promise(r => setTimeout(r, 500));
            }
        }

        return false;
    }

    // --- ฐานข้อมูลคลังเก็บของและนายคลังทุกเมืองในเกม (All Town Storage NPCs Database) ---
    const ALL_STORAGE_NPC_TPLS = new Set([
        "npc_jade_storage",
        "npc_lf_storage",
        "npc_ck_storage",
        "npc_lp_storage",
        "npc_sm_storage",
        "npc_fh_storage",
        "npc_bg_warden",
        "npc_cc_warden",
        "npc_bv_storage",
        "npc_ro_storage",
        "npc_go_storage",
        "npc_cf_storage",
        "npc_hc_pawnshop"
    ]);

    // พิกัดนายคลังประจำทุกเมืองทั่วทั้งยุทธภพ (13 เมืองหลัก)
    const TOWN_STORAGE_NPCS = {
        jade_sky_town:          { mapId: 'jade_sky_town', mapName: 'เมืองหยก', npcTpl: 'npc_jade_storage', npcName: 'นายคลังโจวอัน', npcIndex: 8, x: 101.86, y: 88.42 },
        town_lantern_fort:      { mapId: 'town_lantern_fort', mapName: 'ค่ายโคมแดง', npcTpl: 'npc_lf_storage', npcName: 'นายคลังป้อมหลิวอิง', npcIndex: 5, x: 91.86, y: 78.42 },
        town_crimson_keep:      { mapId: 'town_crimson_keep', mapName: 'ป้อมปราการโลหิต', npcTpl: 'npc_ck_storage', npcName: 'เถ้าแก่คลังทองจินเป่า', npcIndex: 5, x: 91.86, y: 78.42 },
        town_lantern_peak:      { mapId: 'town_lantern_peak', mapName: 'ยอดเขาโคม', npcTpl: 'npc_lp_storage', npcName: 'ผู้อาวุโสคลังทรัพย์เหวินฉาง', npcIndex: 4, x: 88.71, y: 85.39 },
        town_serpent_manor:     { mapId: 'town_serpent_manor', mapName: 'คฤหาสน์อสรพิษ', npcTpl: 'npc_sm_storage', npcName: 'นายคลังอู๋โซ่ว', npcIndex: 4, x: 88.71, y: 85.39 },
        town_frost_harbor:      { mapId: 'town_frost_harbor', mapName: 'ท่าเรือเหมันต์', npcTpl: 'npc_fh_storage', npcName: 'โรงเตี๊ยมอุ่นใจหลิวฮัว', npcIndex: 4, x: 86.86, y: 73.42 },
        town_blade_garrison:    { mapId: 'town_blade_garrison', mapName: 'ค่ายดาบ', npcTpl: 'npc_bg_warden', npcName: 'ผู้พิทักษ์ด่านหยางซิ่ง', npcIndex: 0, x: 70.0, y: 34.5 },
        town_crescent_camp:     { mapId: 'town_crescent_camp', mapName: 'ค่ายจันทร์เสี้ยว', npcTpl: 'npc_cc_warden', npcName: 'ผู้คุมค่ายหลี่เซินหลง', npcIndex: 0, x: 70.0, y: 34.5 },
        town_banyan_village:    { mapId: 'town_banyan_village', mapName: 'หมู่บ้านไทร', npcTpl: 'npc_bv_storage', npcName: 'ผู้ดูแลคลังโพรงไทรเสี่ยวมู่', npcIndex: 4, x: 86.86, y: 73.42 },
        town_ravine_outpost:    { mapId: 'town_ravine_outpost', mapName: 'ด่านหุบเขา', npcTpl: 'npc_ro_storage', npcName: 'โรงรับจำนำเหวินเมิ่ง', npcIndex: 4, x: 86.86, y: 73.42 },
        town_golden_oasis:      { mapId: 'town_golden_oasis', mapName: 'โอเอซิสทองคำ', npcTpl: 'npc_go_storage', npcName: 'ผู้ดูแลคาราวานเซรายเหมาหลาน', npcIndex: 4, x: 83.71, y: 80.39 },
        town_cinnabar_city:     { mapId: 'town_cinnabar_city', mapName: 'เมืองชาด', npcTpl: 'npc_cf_storage', npcName: 'โรงรับจำนำชาดไช่ซื่อ', npcIndex: 4, x: 93.71, y: 90.39 },
        town_high_cloud:        { mapId: 'town_high_cloud', mapName: 'เมฆลอย', npcTpl: 'npc_hc_pawnshop', npcName: 'โรงรับจำนำไช่ต้า', npcIndex: 4, x: 83.71, y: 80.39 }
    };

    // ฟังก์ชันตรวจสอบว่าเทมเพลต NPC เป็นนายคลังหรือไม่
    function isStorageNpcTemplate(tpl) {
        if (!tpl || typeof tpl !== 'string') return false;
        return ALL_STORAGE_NPC_TPLS.has(tpl);
    }

    // ฟังก์ชันดึงข้อมูลนายคลังที่เหมาะสมที่สุด (เมืองปัจจุบัน หรือเมืองของจุดฟาร์มเดิม)
    function getTargetStorageInfo() {
        const game = getGameInstance();
        const curMap = game?.mapId || gameIndexMod?.V?.value?.map || '';

        // 1. ถ้าตัวละครยืนอยู่ในเมืองที่มีคลังอยู่แล้ว
        if (TOWN_STORAGE_NPCS[curMap]) {
            return TOWN_STORAGE_NPCS[curMap];
        }

        // 2. ถ้าจุดฟาร์มเดิม (originSpot) ตั้งอยู่ในเมืองใดเมืองหนึ่ง
        if (originSpot && originSpot.mapId && TOWN_STORAGE_NPCS[originSpot.mapId]) {
            return TOWN_STORAGE_NPCS[originSpot.mapId];
        }

        // 3. ค่าเริ่มต้นคือ นายคลังโจวอัน เมืองหยก (jade_sky_town)
        return TOWN_STORAGE_NPCS['jade_sky_town'];
    }

    // ฟังก์ชันตรวจสอบว่าตัวละครอยู่ใกล้ NPC นายคลังแล้วหรือยัง (ระยะ <= 8.5 ช่อง)
    function isNearStorageNpc() {
        const game = getGameInstance();
        if (!game || !game.pos) return false;

        const curMap = game.mapId || gameIndexMod?.V?.value?.map || '';

        // 1. ตรวจสอบจาก Entity รอบตัว: ต้องเป็น Storage NPC ภายในระยะ 8.5 ช่อง
        if (game.ents) {
            for (const [id, ent] of game.ents) {
                const tpl = ent.data?.tpl || ent.tpl;
                if (tpl && isStorageNpcTemplate(tpl)) {
                    const dist = ent.pos ? ent.pos.distanceTo(game.pos) : 999;
                    if (dist <= 8.5) return true;
                }
            }
        }

        // 2. ตรวจสอบจากพิกัดนายคลังของเมืองปัจจุบัน
        const townStorage = TOWN_STORAGE_NPCS[curMap];
        if (townStorage) {
            const dist = Math.hypot(game.pos.x - townStorage.x, game.pos.y - townStorage.y);
            if (dist <= 8.5) return true;
        }

        return false;
    }

    // ค้นหา NPC นายคลังที่ตัวละครยืนอยู่ใกล้ในขณะนี้ (ส่งคืน ID สำหรับสั่งแพ็คเกจฝากของ)
    function getNearestStorageNpc() {
        try {
            const gameObj = getGameInstance();
            if (gameObj && gameObj.ents && gameObj.pos) {
                let bestStorageNpcId = null;
                let minStorageDist = 99999;

                for (const [id, ent] of gameObj.ents) {
                    const tpl = ent.data?.tpl || ent.tpl;
                    const numId = ent.npc !== undefined ? Number(ent.npc) : Number(id);

                    if (isStorageNpcTemplate(tpl)) {
                        const dist = ent.pos ? ent.pos.distanceTo(gameObj.pos) : 99999;
                        if (dist < minStorageDist) {
                            minStorageDist = dist;
                            bestStorageNpcId = numId;
                        }
                    }
                }

                if (bestStorageNpcId !== null && minStorageDist <= 8.5) {
                    return bestStorageNpcId;
                }
            }
        } catch (e) {}

        const game = getGameInstance();
        const curMap = game?.mapId || gameIndexMod?.V?.value?.map || '';
        if (TOWN_STORAGE_NPCS[curMap] && TOWN_STORAGE_NPCS[curMap].npcIndex !== undefined) {
            return TOWN_STORAGE_NPCS[curMap].npcIndex;
        }

        return 8; // ค่าเริ่มต้น นายคลังโจวอัน เมืองหยก
    }

    // ฟังก์ชันสั่งตัวละครเดินไปหานายคลัง (Storage NPC)
    async function walkToStorageNpc() {
        const storage = getTargetStorageInfo();
        console.log(`🚶 ENI: กำลังเตรียมตัวเดินทางไปคลังเก็บของ ${storage.npcName} (${storage.mapName})...`);

        if (!originSpot) {
            recordOriginSpot();
        }
        isNavigatingShop = true; // ล็อคไม่ให้เขียนทับจุดฟาร์มเดิม

        const gameObj = getGameInstance();
        const curMap = gameObj?.mapId || gameIndexMod?.V?.value?.map || '';

        // ถ้าอยู่ในเมืองที่มีคลังเป้าหมายอยู่แล้ว
        if (curMap === storage.mapId) {
            const dist = (gameObj && gameObj.pos) ? Math.hypot(gameObj.pos.x - storage.x, gameObj.pos.y - storage.y) : 999;
            if (dist <= 8.5) {
                console.log(`💖 ENI: อยู่หน้านายคลัง ${storage.npcName} (${storage.mapName}) อยู่แล้วค่ะ!`);
                return true;
            }

            // ลองสั่งเดินผ่าน walkToNpc
            const targetNpc = getNearestStorageNpc();
            if (gameObj && typeof gameObj.walkToNpc === 'function') {
                try {
                    const ok = gameObj.walkToNpc(targetNpc);
                    if (ok) {
                        console.log("💖 ENI: สั่งเดินไปนายคลังผ่าน walkToNpc:", targetNpc);
                        return true;
                    }
                } catch(e) {}
            }

            // ถ้า walkToNpc ไม่ได้ ให้สั่ง moveToPoint ไปยังพิกัดนายคลังโดยตรง
            if (gameObj && typeof gameObj.moveToPoint === 'function') {
                console.log(`🚶 ENI: เดินไปยังพิกัดนายคลัง (${storage.x}, ${storage.y})...`);
                gameObj.moveToPoint(storage.x, storage.y);
                return true;
            }
        }

        // ถ้าอยู่ต่างแมพ ใช้ระบบนำทาง Journey ข้ามแมพ
        if (gameIndexMod && typeof gameIndexMod.w === 'function' && gameObj && typeof gameObj.goTo === 'function') {
            try {
                const journey = gameIndexMod.w(`${storage.npcName} (${storage.mapName})`, storage.mapId, {
                    point: { x: storage.x, y: storage.y },
                    npc: storage.npcTpl
                });
                if (journey) {
                    const moved = gameObj.goTo(journey);
                    if (moved) {
                        console.log(`💖 ENI: สั่งเดินทางไปคลัง ${storage.npcName} ด้วยระบบนำทาง Journey สำเร็จแล้วค่ะ!`);
                        return true;
                    }
                }
            } catch (e) {
                console.warn("ENI: ใช้ Journey ไปคลังล้มเหลว กำลังลองวิธีสำรอง...", e);
            }
        }

        // สำรอง: moveToPoint
        if (gameObj && typeof gameObj.moveToPoint === 'function') {
            gameObj.moveToPoint(storage.x, storage.y);
            return true;
        }

        return false;
    }

    // ฟังก์ชันรอจนกว่าตัวละครจะเดินทางถึงหน้าคลังจริง
    async function waitForArrivalAtStorage(maxWaitMs = 50000) {
        const storage = getTargetStorageInfo();
        const targetMap = storage.mapId;
        const start = Date.now();
        console.log(`⏳ ENI: กำลังรอตัวละครเดินทางถึงคลังเก็บของ ${storage.npcName} (${storage.mapName})...`);

        // รอ 1 วินาทีให้คำสั่งนำทางเริ่มต้นทำงาน
        for (let i = 0; i < 5; i++) {
            if (isSellCancelled) {
                stopCharacterMovement();
                return false;
            }
            await new Promise(r => setTimeout(r, 200));
        }

        while (Date.now() - start < maxWaitMs) {
            if (isSellCancelled) {
                console.log("🛑 ENI: ยกเลิกการเดินทางไปคลังเก็บของ หยุดเดินทันที");
                stopCharacterMovement();
                return false;
            }

            const game = getGameInstance();
            if (game) {
                const curMap = game.mapId || gameIndexMod?.V?.value?.map || '';

                if (game.loadingMap) {
                    await new Promise(r => setTimeout(r, 800));
                    continue;
                }

                // ถ้าตัวละครเข้าสู่เมืองเป้าหมายและถึงระยะคลังแล้ว
                if (curMap === targetMap && isNearStorageNpc()) {
                    if (typeof game.stopJourney === 'function') game.stopJourney();
                    if (typeof game.playerCommand === 'function') game.playerCommand();
                    console.log(`💖 ENI: ตัวละครเดินทางถึงหน้าคลัง ${storage.npcName} (${storage.mapName}) เรียบร้อยแล้วค่ะ!`);
                    await new Promise(r => setTimeout(r, 600));
                    return true;
                }

                // ถ้าอยู่ในเมืองแล้ว แต่ยังไม่ถึงพิกัดคลัง และหยุดเดินแล้ว
                const isJourneyDone = !game.journey && !game.travelDest && (!game.path || game.path.length === 0);
                if (curMap === targetMap && isJourneyDone) {
                    const distStorage = Math.hypot(game.pos.x - storage.x, game.pos.y - storage.y);
                    if (distStorage > 6.0 && typeof game.moveToPoint === 'function') {
                        console.log(`🚶 ENI: อยู่ในเมืองแล้ว กำลังเดินเข้าหานายคลัง (ห่าง ${distStorage.toFixed(1)} ช่อง).....`);
                        game.moveToPoint(storage.x, storage.y);
                        await new Promise(r => setTimeout(r, 1500));
                        continue;
                    }
                    if (distStorage <= 8.5) {
                        console.log(`💖 ENI: ตัวละครเข้าสู่เมืองและถึงหน้าคลังเรียบร้อยแล้ว!`);
                        await new Promise(r => setTimeout(r, 600));
                        return true;
                    }
                }
            }

            await new Promise(r => setTimeout(r, 600));
        }

        console.warn(`⚠️ ENI: หมดเวลารอการเดินทางไปคลัง ${storage.mapName}`);
        return isNearStorageNpc();
    }

    // ฟังก์ชันสั่งเปิดคลังเก็บของ (Opcode 16: INTERACT, Opcode 49: STORAGE_OPEN)
    async function doOpenStorage(targetNpc) {
        const npcId = targetNpc !== undefined ? targetNpc : getNearestStorageNpc();
        try {
            await sendGameRequest(16, { npc: npcId });
            await new Promise(r => setTimeout(r, 150));
        } catch (e) {}
        try {
            await sendGameRequest(49, { npc: npcId });
            console.log(`📦 ENI: เปิดคลังเก็บของ (NPC: ${npcId}) สำเร็จแล้วค่ะ!`);
            return true;
        } catch (err) {
            console.warn("ENI: ขอเปิดคลังเก็บของไม่สำเร็จ:", err);
            return false;
        }
    }

    // ฟังก์ชันสั่งฝากไอเทมเดี่ยวเข้าคลัง (Opcode 52: STORAGE_PUT)
    async function doDepositItem(itemId, qty, maxRetries = 3) {
        const liveItems = getLiveInventory();
        const item = liveItems.find(i => i.id === itemId);
        const itemQty = qty || (item ? item.q : 1) || 1;
        const itemName = item ? item.name : itemId;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            if (isSellCancelled) return false;

            const game = getGameInstance();
            if (game && game.loadingMap) {
                await new Promise(r => setTimeout(r, 1500));
            }

            // ถ้าตัวละครยังไม่อยู่ในระยะนายคลัง ให้เดินเข้าหาก่อน
            if (!isNearStorageNpc()) {
                const curStorage = getTargetStorageInfo();
                console.warn(`🚨 ENI: ตัวละครยังไม่อยู่ในระยะคลัง ${curStorage.npcName}! กำลังสั่งเดินไปคลัง...`);
                await walkToStorageNpc();
                await waitForArrivalAtStorage(50000);
            }

            const targetNpc = getNearestStorageNpc();

            try {
                // เปิดคลังในรอบแรก
                if (attempt === 1 && targetNpc !== null && targetNpc !== undefined) {
                    try {
                        await sendGameRequest(16, { npc: targetNpc });
                        await new Promise(r => setTimeout(r, 120));
                        await sendGameRequest(49, { npc: targetNpc });
                        await new Promise(r => setTimeout(r, 120));
                    } catch (e) {}
                }

                console.log(`📦 ENI: ส่งคำสั่งฝาก ${itemName} (ID: ${itemId}, จำนวน: ${itemQty}, NPC: ${targetNpc})`);
                await sendGameRequest(52, { npc: targetNpc, id: itemId, qty: itemQty });
                console.log(`💖 ENI: ฝาก ${itemName} เข้าคลังสำเร็จเรียบร้อย!`);
                return true;
            } catch (err) {
                const errStr = String(err);
                console.warn(`ENI: ฝาก ${itemName} ไม่สำเร็จ (รอบที่ ${attempt}/${maxRetries}):`, errStr);

                if (errStr.includes('zone_changing')) {
                    await new Promise(r => setTimeout(r, 2500));
                    continue;
                }

                if (errStr.includes('too_far')) {
                    console.warn(`🚨 ENI: ได้รับ Error: too_far กำลังสั่งเดินเข้านายคลังอีกครั้ง...`);
                    await walkToStorageNpc();
                    await waitForArrivalAtStorage(50000);
                    continue;
                }

                if (errStr.includes('storage_full') || errStr.includes('full') || errStr.includes('no_space')) {
                    console.warn("⚠️ ENI: ตรวจพบคลังเก็บของเต็มแล้ว! หยุดการฝากไอเทมที่เหลือค่ะ");
                    return 'STORAGE_FULL';
                }

                if (errStr.includes('no_item') || errStr.includes('invalid') || errStr.includes('bound')) {
                    console.log(`ℹ️ ENI: ไอเทม ${itemName} ไม่สามารถฝากได้ (${errStr}) ข้ามชิ้นนี้ค่ะ`);
                    return false;
                }

                await new Promise(r => setTimeout(r, 500));
            }
        }

        return false;
    }

    // --- ระบบทิ้งและทำลายไอเทม (Item Discard / Destroy System - Opcode 34) ---
    let destroySeq = 1000;
    async function doDestroyItem(itemId, itemName = 'ไอเทม') {
        if (itemId === undefined || itemId === null) return false;

        const liveItems = getLiveInventory();
        const item = liveItems.find(i => i.id === itemId);
        const name = itemName || item?.name || `ID ${itemId}`;

        // การป้องกัน: ห้ามทิ้ง "คัมภีร์กลับเมือง" เด็ดขาด 100%!
        if (item && (item.t === 's_return' || (item.name && item.name.trim() === 'คัมภีร์กลับเมือง'))) {
            console.warn("⚠️ ENI: ห้ามทิ้งคัมภีร์กลับเมืองเด็ดขาดค่ะ!");
            return false;
        }

        console.log(`🗑️ ENI: กำลังส่งคำสั่งทิ้ง ${name} (ID: ${itemId})...`);
        try {
            await sendGameRequest(34, { id: itemId });
            console.log(`💖 ENI: ทิ้ง ${name} สำเร็จเรียบร้อย!`);
            updateBagCapacityUI();
            return true;
        } catch (err) {
            console.warn(`ENI: ทิ้ง ${name} ไม่สำเร็จ:`, err);
            return false;
        }
    }

    // ฟังก์ชันสั่งทิ้งของเควสต์ทั้งหมดในกระเป๋า
    async function doDestroyAllQuestItems() {
        const liveItems = getLiveInventory();
        const questItems = liveItems.filter(i => i.category === 'quest' || (i.t && i.t.startsWith('q_')));
        if (questItems.length === 0) {
            console.log("ℹ️ ENI: ไม่พบไอเทมเควสต์ในกระเป๋าเลยค่ะ");
            return 0;
        }

        console.log(`🗑️ ENI: เริ่มการทิ้งไอเทมเควสต์ทั้งหมด ${questItems.length} ชิ้น...`);
        let count = 0;
        for (const item of questItems) {
            const ok = await doDestroyItem(item.id, item.name);
            if (ok) count++;
            await new Promise(r => setTimeout(r, 140));
        }
        console.log(`💖 ENI: ดำเนินการทิ้งไอเทมเควสต์เสร็จสิ้นแล้วทั้งหมด ${count}/${questItems.length} ชิ้น!`);
        updateBagCapacityUI();
        const invBox = document.getElementById('eni-inventory-ui');
        if (invBox) invBox.removeAttribute('data-hash');
        return count;
    }

    // --- ระบบวิเคราะห์และเปรียบเทียบอุปกรณ์ (Gear Evaluation & Upgrade Comparison System) ---
    // ค่าน้ำหนักสเตตัสตามสูตรทางการของเกม Pixel Jade Online (Official Stat Weights)
    const STAT_WEIGHTS = {
        atkMin: 1, atkMax: 1, magicAtk: 1, def: 1.5, hp: 0.25, mp: 0.1,
        acc: 0.8, eva: 0.8, crit: 6, critDmg: 2, skillDmg: 3, healPower: 3,
        dmgReduce: 8, atkSpeed: 5, moveSpeed: 2, hpRegen: 0.5, mpRegen: 0.5
    };

    const SLOT_MAPPING = {
        ring1: ['ring1', 'ring2'],
        ring2: ['ring1', 'ring2'],
        earring1: ['earring1', 'earring2'],
        earring2: ['earring1', 'earring2']
    };

    const ALL_SLOTS = [
        'weapon', 'body', 'hands', 'feet', 'inner', 'cloak',
        'necklace', 'earring1', 'earring2', 'ring1', 'ring2', 'amulet',
        'costume', 'pet', 'mount', 'skin'
    ];

    // ฟังก์ชันดึงรายการอุปกรณ์ที่กำลังสวมใส่อยู่แบบเรียลไทม์
    function getEquippedItems() {
        if (gameIndexMod && gameIndexMod.On && Array.isArray(gameIndexMod.On.value) && gameIndexMod.On.value.length > 0) {
            return gameIndexMod.On.value;
        }
        if (gameIndexMod) {
            for (const key of ['On', 'bt', 'We', 'equip', 'equippedItems']) {
                if (gameIndexMod[key] && Array.isArray(gameIndexMod[key].value) && gameIndexMod[key].value.length > 0) {
                    return gameIndexMod[key].value;
                }
            }
        }
        return backupEquipped || [];
    }

    // ฟังก์ชันดึงข้อมูลโปรไฟล์ตัวละคร (สายอาชีพ, เลเวล, เพศ)
    function getPlayerProfile() {
        if (gameIndexMod) {
            for (const key of ['zr', 'K', 'V', 'self', 'player']) {
                if (gameIndexMod[key] && gameIndexMod[key].value && typeof gameIndexMod[key].value === 'object') {
                    const val = gameIndexMod[key].value;
                    if (val.cls || val.lv || val.name) return val;
                }
            }
        }
        return backupSelf || null;
    }

    // คำนวณ Gear Score รวมของอุปกรณ์ชิ้นนั้นๆ
    function getGearScore(item) {
        if (!item || !item.t) return 0;
        const info = gameContentItems?.[item.t];
        if (!info) return 0;
        const enh = item.e || 0;
        const enhanceBonus = enh ? (gameContentEnhance?.find(e => e.level === enh)?.bonus ?? enh * 4) : 0;
        let score = 0;
        for (const [stat, val] of Object.entries(info.stats || {})) {
            score += (STAT_WEIGHTS[stat] || 0) * (Number(val) || 0) * (1 + enhanceBonus / 100);
        }
        for (const [stat, val] of (item.o || [])) {
            score += (STAT_WEIGHTS[stat] || 0) * (Number(val) || 0);
        }
        return score;
    }

    // หาคะแนนของอุปกรณ์ที่ใส่อยู่ในช่องนั้น (ถ้าเป็นแหวน/ต่างหู จะเทียบกับข้างที่คะแนนต่ำสุด)
    function getEquippedScoreForSlot(slot, equippedList) {
        if (!equippedList || !Array.isArray(equippedList) || equippedList.length === 0) return 0;
        const targetSlots = SLOT_MAPPING[slot] || [slot];
        let minScore = Infinity;
        for (const s of targetSlots) {
            const slotIdx = ALL_SLOTS.indexOf(s);
            const equippedItem = equippedList.find(e => e.s === slotIdx);
            minScore = Math.min(minScore, equippedItem ? getGearScore(equippedItem) : 0);
        }
        return minScore === Infinity ? 0 : minScore;
    }

    // ฟังก์ชันเปรียบเทียบอุปกรณ์ในกระเป๋ากับชิ้นที่สวมใส่อยู่
    function evaluateGear(item) {
        if (!item || !item.t) return null;
        const info = gameContentItems?.[item.t];
        if (!info || !info.slot) return null;
        if (!['weapon', 'armor', 'accessory'].includes(info.type)) return null;

        const equippedList = getEquippedItems();
        if (item.id !== undefined && equippedList.some(e => e.id === item.id)) {
            return { mark: 'equipped', label: 'กำลังใส่อยู่' };
        }

        const player = getPlayerProfile();
        if (player) {
            if (info.cls?.length && player.cls && !info.cls.includes(player.cls)) {
                return { mark: 'unusable', label: 'ต่างสายอาชีพ' };
            }
            if (info.gender && player.g && info.gender !== player.g) {
                return { mark: 'unusable', label: 'ต่างเพศ' };
            }
        }

        const itemScore = getGearScore(item);
        const currentScore = getEquippedScoreForSlot(info.slot, equippedList);
        const diff = itemScore - currentScore;

        if (diff <= 1e-6) {
            return { mark: 'worse', label: 'ด้อยกว่าที่ใส่', diff: Math.round(diff) };
        }

        if (player && player.lv && info.level > player.lv) {
            return {
                mark: 'later',
                label: `ดีกว่า (รอ Lv.${info.level})`,
                diff: Math.round(diff),
                reqLevel: info.level
            };
        }

        return {
            mark: 'better',
            label: 'ดีกว่าที่ใส่!',
            diff: Math.round(diff)
        };
    }

    // ฟังก์ชันสั่งสวมใส่อุปกรณ์ทันที 1 คลิก (Opcode 32: INV_EQUIP)
    async function doEquipItem(itemId) {
        if (itemId === undefined || itemId === null) return false;
        console.log(`⚔️ ENI: กำลังส่งคำสั่งสวมใส่อุปกรณ์ ID: ${itemId}...`);
        try {
            await sendGameRequest(32, { id: itemId });
            console.log(`💖 ENI: สวมใส่อุปกรณ์สำเร็จเรียบร้อย!`);
            updateBagCapacityUI();
            const invBox = document.getElementById('eni-inventory-ui');
            if (invBox) invBox.removeAttribute('data-hash');
            return true;
        } catch (err) {
            console.warn(`ENI: สวมใส่อุปกรณ์ไม่สำเร็จ:`, err);
            return false;
        }
    }

    // --- ระบบจดจำพิกัดเดิม และเดินกลับจุดฟาร์มอัตโนมัติ (Navigation & Origin Tracking) ---
    let originSpot = null;
    let isNavigatingShop = false;

    // ฟังก์ชันดึง Game Instance (GameScreen) แบบเสถียร 100%
    function getGameInstance() {
        if (pageWindow.__ENI_GAME_INSTANCE__) return pageWindow.__ENI_GAME_INSTANCE__;
        if (gameIndexMod && gameIndexMod.It) return gameIndexMod.It;
        return null;
    }

    // ฟังก์ชันอัปเดตข้อความพิกัดบน UI
    function updateOriginSpotUI() {
        const label = document.getElementById('eni-origin-label');
        if (label) {
            label.innerText = originSpot ? `📍 จุดเดิม: ${originSpot.label}` : '📍 จุดเดิม: ยังไม่ได้บันทึก';
            label.style.color = originSpot ? '#88ff88' : '#aaa';
        }
    }

    // ฟังก์ชันแปลชื่อแผนที่อย่างปลอดภัย 100% (ไม่แตะต้องระบบสลับภาษาของเกมเด็ดขาด)
    function getMapDisplayName(mapId) {
        if (!mapId) return 'ปัจจุบัน';
        try {
            if (typeof gameTranslatorFn === 'function') {
                const t = gameTranslatorFn('map.' + mapId);
                if (t && typeof t === 'string' && !t.startsWith('map.')) return t;
            }
            if (gameIndexMod && typeof gameIndexMod.ji === 'function') {
                const t = gameIndexMod.ji('map.' + mapId);
                if (t && typeof t === 'string' && !t.startsWith('map.')) return t;
            }
        } catch (e) {}
        return mapId || 'ปัจจุบัน';
    }

    // ค้นหาปุ่ม Auto บนหน้าจอเกม (ครอบคลุมทั้งคลาส .arc-btn.auto, ไอคอน .auto-gear และปุ่ม .auto-go)
    function findAutoBtn() {
        return document.querySelector('button.arc-btn.auto, button[class*="arc-btn"][class*="auto"]') ||
               document.querySelector('.auto-gear')?.closest('button') ||
               document.querySelector('button[title*="Auto"], button[title*="ออโต้"], button[title*="อัตโนมัติ"]') ||
               document.querySelector('button.auto-go');
    }

    // ฟังก์ชันตรวจสอบว่าระบบออโต้ตีของเกมเปิดทำงานอยู่หรือไม่
    function isAutoHuntActive() {
        // 1. ตรวจสอบจากปุ่ม Auto บนหน้าจอ HUD หรือกล่องตั้งค่าของเกม
        const autoBtn = findAutoBtn();
        if (autoBtn) {
            if (autoBtn.classList.contains('on') || autoBtn.classList.contains('active') || autoBtn.classList.contains('danger')) {
                return true;
            }
        }

        // 2. ตรวจสอบจาก Game Instance (autoWasOn อัปเดตทุกเฟรมตาม qe.value ของเกม)
        const game = getGameInstance();
        if (game && typeof game.autoWasOn === 'boolean') {
            if (game.autoWasOn) return true;
        }

        // 3. ตรวจสอบจากบอท PixelJade Helper (ถ้ามี)
        const pjCheck = document.getElementById('pj-bot-active');
        if (pjCheck && pjCheck.checked) return true;

        return false;
    }

    // ฟังก์ชันอัปเดตสไตล์และข้อความของปุ่ม "⚔️ ออโต้ตี" บนแผง ENI
    function updateAutoHuntButtonUI() {
        const btn = document.getElementById('eni-auto-hunt-btn');
        if (!btn) return;
        const active = isAutoHuntActive();
        if (active) {
            btn.innerText = '⚔️ ออโต้: เปิด';
            btn.style.background = '#00bb66';
            btn.style.borderColor = '#33ff88';
            btn.style.color = '#fff';
            btn.style.boxShadow = '0 0 8px rgba(0, 255, 120, 0.45)';
        } else {
            btn.innerText = '⚔️ ออโต้: ปิด';
            btn.style.background = '#2a2a2e';
            btn.style.borderColor = '#555';
            btn.style.color = '#ccc';
            btn.style.boxShadow = 'none';
        }
    }

    // ฟังก์ชันสั่งเปิดระบบ "ออโต้ตี" (Auto-Hunt / Auto-Attack) ของเกมอย่างแน่นอน 100%
    function enableAutoHunt() {
        console.log("⚔️ ENI: กำลังเปิดระบบออโต้ตีให้ทริสค่ะ...");

        if (isAutoHuntActive()) {
            console.log("⚔️ ENI: ระบบออโต้ตีเปิดทำงานอยู่แล้วค่ะ!");
            updateAutoHuntButtonUI();
            return true;
        }

        const fireTrigger = () => {
            // 1. ส่งสัญญาณ CustomEvent 'pj-key' สำหรับ Backquote ไปยัง pageWindow (unsafeWindow) และ window
            try {
                const ce = new (pageWindow.CustomEvent || CustomEvent)('pj-key', {
                    detail: { code: 'Backquote' },
                    bubbles: true,
                    cancelable: true
                });
                if (pageWindow && typeof pageWindow.dispatchEvent === 'function') {
                    pageWindow.dispatchEvent(ce);
                }
                window.dispatchEvent(ce);
            } catch (e) {}

            // 2. คลิกปุ่ม Auto บนหน้าจอ HUD ของเกมโดยตรง
            const autoBtn = findAutoBtn();
            if (autoBtn) {
                try {
                    autoBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: pageWindow }));
                    autoBtn.click();
                } catch (e) {}
            }

            // 3. ส่ง KeyboardEvent Backquote
            try {
                const ke = new (pageWindow.KeyboardEvent || KeyboardEvent)('keydown', {
                    code: 'Backquote',
                    key: '`',
                    keyCode: 192,
                    which: 192,
                    bubbles: true,
                    cancelable: true
                });
                if (pageWindow && typeof pageWindow.dispatchEvent === 'function') {
                    pageWindow.dispatchEvent(ke);
                }
                window.dispatchEvent(ke);
                document.dispatchEvent(ke);
            } catch (e) {}

            // 4. บอท PixelJade Helper (ถ้ามี)
            const pjCheck = document.getElementById('pj-bot-active');
            if (pjCheck && !pjCheck.checked) {
                try { pjCheck.click(); } catch (e) {}
            }
        };

        fireTrigger();

        // ตรวจสอบซ้ำอีกครั้งใน 300ms หากยังไม่ติด ให้กระตุ้นซ้ำทันที
        setTimeout(() => {
            if (!isAutoHuntActive()) {
                console.log("⚠️ ENI: ตรวจพบปุ่มออโต้ยังไม่ติด กำลังกระตุ้นซ้ำรอบสอง...");
                fireTrigger();
            } else {
                console.log("💖⚔️ ENI: ยืนยันระบบออโต้ตีเปิดทำงานสมบูรณ์แล้วค่ะ!");
            }
            updateAutoHuntButtonUI();
        }, 300);

        return true;
    }

    // ฟังก์ชันสั่งปิดระบบ "ออโต้ตี"
    function disableAutoHunt() {
        console.log("⚔️ ENI: กำลังปิดระบบออโต้ตี...");

        if (!isAutoHuntActive()) {
            updateAutoHuntButtonUI();
            return true;
        }

        // 1. สั่งผ่าน Game Instance ให้หยุดตีทันที (playerCommand)
        const game = getGameInstance();
        if (game && typeof game.playerCommand === 'function') {
            try { game.playerCommand(); } catch (e) {}
        }

        // 2. ส่งสัญญาณ Backquote เพื่อสลับปิด
        try {
            const ce = new (pageWindow.CustomEvent || CustomEvent)('pj-key', {
                detail: { code: 'Backquote' },
                bubbles: true,
                cancelable: true
            });
            if (pageWindow && typeof pageWindow.dispatchEvent === 'function') {
                pageWindow.dispatchEvent(ce);
            }
            window.dispatchEvent(ce);
        } catch (e) {}

        // 3. คลิกปุ่มถ้ายังมีคลาส on
        const autoBtn = findAutoBtn();
        if (autoBtn && (autoBtn.classList.contains('on') || autoBtn.classList.contains('active'))) {
            try { autoBtn.click(); } catch (e) {}
        }

        // 4. ปิดบอท PixelJade Helper (ถ้ามี)
        const pjCheck = document.getElementById('pj-bot-active');
        if (pjCheck && pjCheck.checked) {
            try { pjCheck.click(); } catch (e) {}
        }

        setTimeout(updateAutoHuntButtonUI, 250);
        return true;
    }

    // ฟังก์ชันสลับ เปิด/ปิด ออโต้ตี (Toggle)
    function toggleAutoHunt() {
        if (isAutoHuntActive()) {
            disableAutoHunt();
        } else {
            enableAutoHunt();
        }
    }

    // ฟังก์ชันบันทึกจุดฟาร์มเดิม (พิกัด และ แมพ)
    function recordOriginSpot(manual = false) {
        const game = getGameInstance();
        const map = game?.mapId || gameIndexMod?.V?.value?.map || '';
        const pos = game?.pos ? { x: Math.round(game.pos.x), y: Math.round(game.pos.y) } : null;
        const isAuto = isAutoHuntActive();

        if (pos) {
            const mapName = getMapDisplayName(map);
            originSpot = {
                mapId: map,
                x: pos.x,
                y: pos.y,
                autoWasOn: isAuto,
                label: `${mapName} (${pos.x}, ${pos.y})`
            };
            console.log(`📍 ENI: จำพิกัดจุดเดิมเรียบร้อยแล้ว: ${originSpot.label} (ออโต้ตี: ${isAuto ? 'เปิดอยู่' : 'ปิดอยู่'})`);
            updateOriginSpotUI();
            return originSpot;
        } else {
            if (manual) console.warn("ENI: ยังไม่สามารถอ่านพิกัดตัวละครได้ในขณะนี้ กรุณารอตัวละครเข้าเกมก่อนนะคะ");
            return null;
        }
    }

    // คอยจดจำพิกัดล่าสุดที่ตัวละครกำลังฟาร์มอยู่ (ถ้าเปิดโหมดล่าหรืออยู่ในแมพฟาร์ม)
    setInterval(() => {
        if (isNavigatingShop) return; // ถ้ากำลังเดินไปร้านค้าหรือขายของ ไม่เขียนทับจุดฟาร์มเดิม
        const game = getGameInstance();
        if (game && game.pos) {
            const isAutoOn = isAutoHuntActive();
            if (isAutoOn) {
                const map = game.mapId || gameIndexMod?.V?.value?.map || '';
                const mapName = getMapDisplayName(map);
                originSpot = {
                    mapId: map,
                    x: Math.round(game.pos.x),
                    y: Math.round(game.pos.y),
                    autoWasOn: true,
                    label: `${mapName} (${Math.round(game.pos.x)}, ${Math.round(game.pos.y)})`
                };
                updateOriginSpotUI();
            }
        }
    }, 2500);

    // ฟังก์ชันสั่งตัวละครเดินไปหา NPC ร้านค้าอัตโนมัติ (รองรับทุกเมืองตามตำแหน่งปัจจุบัน)
    async function walkToShopNpc() {
        const shop = getTargetShopInfo();
        console.log(`🚶 ENI: กำลังเตรียมตัวเดินทางไปร้านค้า ${shop.npcName} (${shop.mapName})...`);

        // จำจุดฟาร์มเดิมไว้ก่อนออกเดินทางเสมอ
        if (!originSpot) {
            recordOriginSpot();
        }
        isNavigatingShop = true;

        const gameObj = getGameInstance();

        // 1. นำทางด้วย Journey ข้ามแมพ (gameIndexMod.w) ไปยังร้านค้าของเมืองเป้าหมาย
        if (gameIndexMod && typeof gameIndexMod.w === 'function' && gameObj && typeof gameObj.goTo === 'function') {
            try {
                const journey = gameIndexMod.w(`${shop.npcName} (${shop.mapName})`, shop.mapId, {
                    point: { x: shop.x, y: shop.y },
                    npc: shop.npcTpl
                });
                if (journey) {
                    const moved = gameObj.goTo(journey);
                    if (moved) {
                        console.log(`💖 ENI: สั่งเดินทางไปร้านค้า ${shop.npcName} ด้วยระบบนำทาง Journey สำเร็จแล้วค่ะ!`);
                        return true;
                    }
                }
            } catch (e) {
                console.warn("ENI: ใช้ Journey ไปร้านค้าล้มเหลว กำลังลองวิธีสำรอง...", e);
            }
        }

        // 2. ถ้าอยู่ในเมืองอยู่แล้ว ให้สั่ง walkToNpc
        try {
            if (gameObj) {
                const targetNpc = getNearestShopNpc();
                if (typeof gameObj.walkToNpc === 'function') {
                    const ok = gameObj.walkToNpc(targetNpc);
                    if (ok) {
                        console.log("💖 ENI: สั่งตัวละครเดินผ่าน walkToNpc ไปยัง NPC:", targetNpc);
                        return true;
                    }
                }
            }
        } catch (e) {}

        // 3. ถ้าอยู่ในแมพเดียวกัน ให้สั่งเดินไปยังพิกัดร้านค้าตรงๆ
        if (gameObj && typeof gameObj.moveToPoint === 'function' && gameObj.mapId === shop.mapId) {
            gameObj.moveToPoint(shop.x, shop.y);
            return true;
        }


        // 4. จำลองการคลิกปุ่ม 'บริการ' (🏪 บริการ) ในเมนู HUD เพื่อเปิดหน้าต่างและคลิกเดินไปร้านยา/อาวุธ
        const svcBtn = document.querySelector('.mm-svc, [data-hud-el="services"]');
        if (svcBtn) {
            svcBtn.click();
            await new Promise(r => setTimeout(r, 250));

            // หาปุ่มเดินไปร้านในเมนูบริการ
            const walkBtns = Array.from(document.querySelectorAll('.services-menu button, .sv-row button'));
            const targetWalkBtn = walkBtns.find(b => {
                const text = b.innerText || '';
                return text.includes('เดิน') || text.includes('ร้าน') || text.includes('ยา') || text.includes('อาวุธ');
            });

            if (targetWalkBtn) {
                targetWalkBtn.click();
                console.log("💖 ENI: กดสั่งเดินไปร้านค้าผ่านเมนูบริการเรียบร้อยค่ะ!");
                return true;
            }
        }

        console.warn("⚠️ ENI: ไม่สามารถหาเส้นทางเดินไปร้านค้าได้");
        return false;
    }

    // ฟังก์ชันสั่งเดินกลับมายังจุดฟาร์มเดิม (รองรับทั้งในแมพเดิม และข้ามแมพ/วาร์ป)
    async function walkBackToOrigin() {
        if (!originSpot) {
            console.warn("⚠️ ENI: ไม่มีจุดเดิมให้กลับ ต้องบันทึกจุดเดิม 'บันทึกจุดเดิม' ก่อนค่ะ!");
            return false;
        }

        console.log(`🔙 ENI: สั่งเดินทางกลับมายังจุดฟาร์มเดิม ${originSpot.label}...`);
        const game = getGameInstance();
        if (!game) {
            console.warn("ENI: ไม่พบ Game Instance ไม่สามารถเดินกลับได้");
            return false;
        }

        let moved = false;

        // 1. ลองเดินด้วยระบบ Journey แบบเต็ม (gameIndexMod.w + game.goTo) - ข้ามแมพได้!
        if (gameIndexMod && typeof gameIndexMod.w === 'function' && typeof game.goTo === 'function') {
            try {
                const journey = gameIndexMod.w('จุดฟาร์มเดิม', originSpot.mapId, {
                    point: { x: originSpot.x, y: originSpot.y },
                    hunt: true
                });
                if (journey) {
                    moved = game.goTo(journey);
                    if (moved) {
                        console.log("💖 ENI: สั่งเดินทางกลับจุดฟาร์มด้วยระบบนำทาง Journey สำเร็จแล้วค่ะ!");
                    }
                }
            } catch (e) {
                console.warn("ENI: Journey ล้มเหลว:", e);
            }
        }

        // 2. Fallback: moveToPoint ถ้า Journey ไม่ได้ (เฉพาะในแมพเดิม)
        if (!moved && originSpot.mapId === (game.mapId || '') && typeof game.moveToPoint === 'function') {
            game.moveToPoint(originSpot.x, originSpot.y);
            moved = true;
            console.log("🚶 ENI: ใช้ moveToPoint เดินกลับจุดฟาร์ม");
        }

        return moved;
    }

    // ฟังก์ชันรอจนกว่าตัวละครจะเดินทางกลับถึงจุดฟาร์มเดิมจริง
    async function waitForArrivalAtOrigin(targetSpot, maxWaitMs = 50000) {
        if (!targetSpot) return false;
        const start = Date.now();
        console.log(`⏳ ENI: กำลังรอตัวละครเดินทางกลับถึงจุดฟาร์มเดิม (${targetSpot.label})...`);

        // รอ 2 วินาทีให้คำสั่งนำทางเริ่มต้นทำงาน (เช็คยกเลิกทุก 200ms)
        for (let i = 0; i < 10; i++) {
            if (isSellCancelled) {
                stopCharacterMovement();
                return false;
            }
            await new Promise(r => setTimeout(r, 200));
        }

        while (Date.now() - start < maxWaitMs) {
            if (isSellCancelled) {
                console.log("🛑 ENI: ยกเลิกการเดินทางกลับจุดเดิม หยุดเดินทันที");
                stopCharacterMovement();
                return false;
            }
            const game = getGameInstance();
            if (game) {
                // ถ้าเกมกำลังโหลดฉากอยู่ ให้รอก่อน
                if (game.loadingMap) {
                    await new Promise(r => setTimeout(r, 800));
                    continue;
                }

                const curMap = game.mapId || gameIndexMod?.V?.value?.map || '';

                // ตรวจสอบว่าอยู่ในแมพเดิมและถึงพิกัดแล้ว
                if (curMap === targetSpot.mapId && game.pos) {
                    const dist = Math.hypot(game.pos.x - targetSpot.x, game.pos.y - targetSpot.y);
                    const isJourneyDone = !game.journey && !game.travelDest && (!game.path || game.path.length === 0);

                    // ถือว่าถึงแล้วถ้า <= 5 ช่อง หรือ Journey จบและ <= 8.5 ช่อง (เผื่อพิกัดคลาดเคลื่อน)
                    if (dist <= 5.0 || (isJourneyDone && dist <= 8.5)) {
                        console.log(`💖 ENI: ตัวละครเดินทางกลับถึงจุดฟาร์มเดิมแล้ว! (ห่าง ${dist.toFixed(1)} ช่อง)`);
                        await new Promise(r => setTimeout(r, 600));
                        return true;
                    }
                }
            }

            await new Promise(r => setTimeout(r, 600));
        }

        console.warn("⚠️ ENI: หมดเวลารอการเดินทางกลับจุดฟาร์มเดิม");
        return false;
    }

    let isSellingRoutineRunning = false;
    let isSellCancelled = false;
    let currentRoutineType = 'sell'; // 'sell' หรือ 'deposit'

    // ฟังก์ชันสั่งหยุดการเคลื่อนที่ของตัวละครทุกรูปแบบทันที
    function stopCharacterMovement() {
        const game = getGameInstance();
        if (!game) return;
        try {
            if (typeof game.stopJourney === 'function') game.stopJourney();
            if (typeof game.playerCommand === 'function') game.playerCommand();
            if (typeof game.cancelDest === 'function') game.cancelDest();
            if (game.path) game.path = [];
            game.travelDest = null;
            game.journey = null;
            if (game.pos && typeof game.moveToPoint === 'function') {
                game.moveToPoint(Math.round(game.pos.x), Math.round(game.pos.y));
            }
        } catch (e) {
            console.warn("ENI: stopCharacterMovement error:", e);
        }
    }

    // ฟังก์ชันสั่งยกเลิกกระบวนการขายของทันที และสั่งหยุดตัวละคร
    function cancelSellTrip() {
        if (!isSellingRoutineRunning && !isNavigatingShop) {
            console.log("ℹ️ ENI: ไม่ได้อยู่ในกระบวนการขายของค่ะ");
            return;
        }

        console.log("🛑 ENI: ได้รับคำสั่งยกเลิกกระบวนการขายของ! กำลังหยุดตัวละครทันที...");
        isSellCancelled = true;
        isSellingRoutineRunning = false;
        isNavigatingShop = false;

        stopCharacterMovement();

        const sellNowBtn = document.getElementById('eni-sell-now-btn');
        if (sellNowBtn) {
            sellNowBtn.disabled = false;
            sellNowBtn.innerText = '🔥 ไปขายทันที';
            sellNowBtn.style.background = 'linear-gradient(135deg, #ff8800, #ff5500)';
            sellNowBtn.style.boxShadow = '0 2px 6px rgba(255,100,0,0.3)';
        }

        const depBtn = document.getElementById('eni-deposit-now-btn');
        if (depBtn) {
            depBtn.disabled = false;
            depBtn.innerText = '📦 ไปฝากทันที';
            depBtn.style.background = 'linear-gradient(135deg, #4caf50, #2e7d32)';
            depBtn.style.boxShadow = '0 2px 6px rgba(76,175,80,0.3)';
        }

        updateLoopStatusUI();
        updateBagCapacityUI();
        console.log("🛑 ENI: ยกเลิกกระบวนการเดินทางและหยุดตัวละครเรียบร้อยแล้วค่ะ!");
    }

    // ฟังก์ชันอัปเดตสถานะปุ่ม Loop บน UI
    function updateLoopStatusUI() {
        const loopBtn = document.getElementById('eni-auto-sell-loop-btn');
        const loopIcon = document.getElementById('eni-loop-icon');
        const loopText = document.getElementById('eni-loop-text');
        const statusText = document.getElementById('eni-loop-status-text');

        if (!loopBtn) return;

        if (isSellingRoutineRunning) {
            loopBtn.style.background = '#ff8800';
            loopBtn.style.color = '#fff';
            loopBtn.style.borderColor = '#ffaa33';
            if (loopIcon) loopIcon.innerText = '⏳';
            if (loopText) loopText.innerText = (currentRoutineType === 'deposit') ? 'กำลังฝาก...' : 'กำลังขาย...';
            if (statusText) {
                statusText.innerText = (currentRoutineType === 'deposit') ? 'กำลังไปฝากของ...' : 'กำลังไปขายของ...';
                statusText.style.color = '#ffaa00';
            }
            const sellNowBtn = document.getElementById('eni-sell-now-btn');
            if (sellNowBtn) {
                sellNowBtn.disabled = false;
                sellNowBtn.innerText = '🛑 ยกเลิก';
                sellNowBtn.style.background = 'linear-gradient(135deg, #d32f2f, #9a0007)';
                sellNowBtn.style.boxShadow = '0 2px 8px rgba(220, 20, 20, 0.5)';
            }
            const depBtn = document.getElementById('eni-deposit-now-btn');
            if (depBtn) {
                depBtn.disabled = false;
                depBtn.innerText = '🛑 ยกเลิก';
                depBtn.style.background = 'linear-gradient(135deg, #d32f2f, #9a0007)';
                depBtn.style.boxShadow = '0 2px 8px rgba(220, 20, 20, 0.5)';
            }
        } else if (AUTO_SELL_CONFIG.loopActive) {
            loopBtn.style.background = '#00aa55';
            loopBtn.style.color = '#fff';
            loopBtn.style.borderColor = '#22cc77';
            if (loopIcon) loopIcon.innerText = '🟢';
            if (loopText) loopText.innerText = 'Loop Active';
            if (statusText) {
                statusText.innerText = 'ตรวจกระเป๋าเต็ม (รันอยู่)';
                statusText.style.color = '#88ff88';
            }
        } else {
            loopBtn.style.background = '#222';
            loopBtn.style.color = '#aaa';
            loopBtn.style.borderColor = '#555';
            if (loopIcon) loopIcon.innerText = '⏹️';
            if (loopText) loopText.innerText = 'Start Loop';
            if (statusText) {
                statusText.innerText = 'ปิดอยู่';
                statusText.style.color = '#aaa';
            }
        }

        if (!isSellingRoutineRunning) {
            const sellNowBtn = document.getElementById('eni-sell-now-btn');
            if (sellNowBtn && sellNowBtn.innerText.includes('ยกเลิก')) {
                sellNowBtn.disabled = false;
                sellNowBtn.innerText = '🔥 ไปขายทันที';
                sellNowBtn.style.background = 'linear-gradient(135deg, #ff8800, #ff5500)';
                sellNowBtn.style.boxShadow = '0 2px 6px rgba(255,100,0,0.3)';
            }
        }
    }

    // ฟังก์ชันอัปเดตตัวเลขความจุกระเป๋าและจำนวนของที่ตรงเงื่อนไขบน UI
    function updateBagCapacityUI() {
        const liveItems = getLiveInventory();
        const usedSlots = liveItems ? liveItems.length : 0;
        const maxSlots = getMaxBagSlots();

        const countLabel = document.getElementById('eni-bag-count');
        const maxLabel = document.getElementById('eni-bag-max');
        const badgeEl = document.getElementById('eni-bag-slots-badge');
        const tagEl = document.getElementById('eni-bag-status-tag');
        const sellableCountLabel = document.getElementById('eni-sellable-count-label');

        if (countLabel) countLabel.innerText = usedSlots;
        if (maxLabel) maxLabel.innerText = maxSlots;

        if (badgeEl) {
            if (usedSlots >= maxSlots && maxSlots > 0) {
                badgeEl.style.background = '#991111';
                badgeEl.style.color = '#ffffff';
                badgeEl.style.borderColor = '#ff4444';
                if (tagEl) {
                    tagEl.innerText = '⚠️ เต็มแล้ว!';
                    tagEl.style.color = '#ff5555';
                }
            } else if (usedSlots >= maxSlots * 0.85) {
                badgeEl.style.background = '#4a3600';
                badgeEl.style.color = '#ffbb33';
                badgeEl.style.borderColor = '#ffaa00';
                if (tagEl) {
                    tagEl.innerText = '(ใกล้เต็ม)';
                    tagEl.style.color = '#ffbb33';
                }
            } else {
                badgeEl.style.background = '#2a2a2a';
                badgeEl.style.color = '#88ff88';
                badgeEl.style.borderColor = '#444';
                if (tagEl) {
                    tagEl.innerText = '';
                }
            }
        }

        if (sellableCountLabel && liveItems) {
            const sellableCount = liveItems.filter(isItemSellable).length;
            sellableCountLabel.innerText = `ตรงเงื่อนไขขาย: ${sellableCount} ชิ้น`;
        }

        const depositableCountLabel = document.getElementById('eni-depositable-count-label');
        if (depositableCountLabel && liveItems) {
            const depositableCount = liveItems.filter(isItemDepositable).length;
            depositableCountLabel.innerText = `ฝากได้: ${depositableCount} ชิ้น`;
        }
    }

    // ฟังก์ชันเปิด/ปิด Auto-Sell Loop
    function toggleAutoSellLoop(forcedState) {
        if (typeof forcedState === 'boolean') {
            AUTO_SELL_CONFIG.loopActive = forcedState;
        } else {
            AUTO_SELL_CONFIG.loopActive = !AUTO_SELL_CONFIG.loopActive;
        }
        saveAutoSellConfig();
        updateLoopStatusUI();
        console.log(`💖 ENI: โหมด Auto-Sell Loop: ${AUTO_SELL_CONFIG.loopActive ? 'เปิดใช้งาน ✅ (คอยตรวจกระเป๋าเต็ม)' : 'ปิดการทำงาน ❌'}`);
    }

    // --- ระบบคัมภีร์กลับเมือง (Return Scroll Navigation) ---
    // ค้นหา raw item ของ 'คัมภีร์กลับเมือง' จากทุกแหล่งที่เป็นไปได้ (เพื่อความแน่นอน 100%)
    // เกมใช้ vt.value (lt as vt ใน GameScreen) เป็น inventory จริงสำหรับ auto-hunt ภายใน
    function getReturnScrollRawItem() {
        // แหล่งที่ 1: vt.value (ตรงจาก GameScreen internals ตาม dumped_autohunt.js)
        if (gameIndexMod && gameIndexMod.vt && Array.isArray(gameIndexMod.vt.value)) {
            const found = gameIndexMod.vt.value.find(i => i && i.t === 's_return');
            if (found) return found;
        }
        // แหล่งที่ 2: mn.value (Vue reactive ref)
        if (gameIndexMod && gameIndexMod.mn && Array.isArray(gameIndexMod.mn.value)) {
            const found = gameIndexMod.mn.value.find(i => i && i.t === 's_return');
            if (found) return found;
        }
        // แหล่งที่ 3: backupInventory (จาก WebSocket taps op 216/217)
        if (backupInventory && backupInventory.length > 0) {
            const found = backupInventory.find(i => i && i.t === 's_return');
            if (found) return found;
        }
        // แหล่งที่ 4: Game Instance inventory
        const gameObj = getGameInstance();
        if (gameObj && gameObj.inventory && Array.isArray(gameObj.inventory)) {
            const found = gameObj.inventory.find(i => i && i.t === 's_return');
            if (found) return found;
        }
        return null;
    }

    // ค้นหาเฉพาะ "คัมภีร์กลับเมือง" (Template: 's_return' เท่านั้น)
    function getReturnScrollItem() {
        // ลองหาจาก raw source ก่อน (เร็วและแน่นอนกว่า)
        const raw = getReturnScrollRawItem();
        if (raw) return raw;
        // fallback: getLiveInventory (อาจมีข้อมูลชื่อแปล)
        const liveItems = getLiveInventory();
        return liveItems.find(i => i.t === 's_return' || (i.name && i.name.trim() === 'คัมภีร์กลับเมือง')) || null;
    }

    // นับจำนวน "คัมภีร์กลับเมือง" ทั้งหมดในกระเป๋า
    function getReturnScrollCount() {
        // ตรวจจาก vt.value ก่อน (แหล่งที่ไว้ใจที่สุด)
        if (gameIndexMod && gameIndexMod.vt && Array.isArray(gameIndexMod.vt.value)) {
            let total = 0;
            for (const i of gameIndexMod.vt.value) {
                if (i && i.t === 's_return') total += (i.q || 1);
            }
            if (total > 0) return total;
        }
        // fallback: getLiveInventory
        const liveItems = getLiveInventory();
        let total = 0;
        for (const item of liveItems) {
            if (item.t === 's_return' || (item.name && item.name.trim() === 'คัมภีร์กลับเมือง')) {
                total += (item.q || 1);
            }
        }
        // fallback ท้ายสุด: backupInventory โดยตรง
        if (total === 0 && backupInventory && backupInventory.length > 0) {
            for (const i of backupInventory) {
                if (i && i.t === 's_return') total += (i.q || 1);
            }
        }
        return total;
    }

    // ฟังก์ชันอัปเดต UI คัมภีร์กลับเมืองแบบเรียลไทม์ (ระดับ Global Scope)
    function updateReturnScrollUI() {
        const badge = document.getElementById('eni-scroll-badge');
        const countEl = document.getElementById('eni-scroll-count');
        if (!badge || !countEl) return;
        const count = getReturnScrollCount();
        countEl.innerText = count;
        if (count > 0) {
            badge.style.color = '#ffd966';
            badge.style.background = '#332900';
            badge.style.borderColor = '#665200';
            badge.title = `มีคัมภีร์กลับเมือง ${count} ใบ พร้อมใช้งาน`;
        } else {
            badge.style.color = '#ff8888';
            badge.style.background = '#2a1111';
            badge.style.borderColor = '#552222';
            badge.title = 'ไม่มีคัมภีร์กลับเมืองในกระเป๋า (ระบบจะสลับเป็นเดินปกติอัตโนมัติหากถึงเวลาขาย)';
        }
    }

    // ส่งคำสั่งใช้งาน "คัมภีร์กลับเมือง" ข้ามไปเมืองทันที (Opcode 31: INV_USE)
    // คืนค่า: { success: bool, inCombat: bool }
    async function useReturnScrollItem() {
        const scroll = getReturnScrollItem();
        if (!scroll) {
            console.warn("⚠️ ENI: ไม่พบ 'คัมภีร์กลับเมือง' ในกระเป๋า");
            return { success: false, inCombat: false };
        }

        console.log(`📜 ENI: ส่งคำสั่งใช้งาน "คัมภีร์กลับเมือง" (ID: ${scroll.id})...`);
        let sent = false;
        let inCombat = false;

        try {
            await sendGameRequest(31, { id: scroll.id });
            sent = true;
            console.log("💖 ENI: ส่งคำสั่งใช้คัมภีร์กลับเมืองสำเร็จเรียบร้อย!");
        } catch (err) {
            const errStr = String(err);
            if (errStr.includes('in_combat')) {
                inCombat = true;
                console.log("⚔️ ENI: ติดสถานะต่อสู้ — จะเดินไปก่อนและปล่อยคัมภีร์เมื่อหมดต่อสู้...");
            } else {
                console.warn("ENI: ใช้คัมภีร์กลับเมืองล้มเหลว:", err);
            }
        }

        if (inCombat) {
            return { success: false, inCombat: true };
        }

        if (!sent) {
            console.error("❌ ENI: ไม่พบช่องทางส่งคำสั่งใช้คัมภีร์กลับเมือง");
            return { success: false, inCombat: false };
        }

        // รอระบบวาร์ปและดาวน์โหลดแมพเมือง
        console.log("⏳ ENI: รอตัวเกมโหลดแมพเมืองหลังใช้วาร์ป...");
        await new Promise(r => setTimeout(r, 1200));
        const gameObj = getGameInstance();
        if (gameObj) {
            let waitCount = 0;
            while (gameObj.loadingMap && waitCount < 30) {
                await new Promise(r => setTimeout(r, 300));
                waitCount++;
            }
        }

        return { success: true, inCombat: false };
    }

    // เดินไปร้านค้าก่อน ระหว่างเดิน: ตรวจทุก 2 วินาทีว่าหมดต่อสู้แล้วหรือยัง
    // ถ้าหมดต่อสู้ → หยุดเดินทันที และใช้คัมภีร์วาร์ปเลย
    // คืนค่า: true ถ้าวาร์ปสำเร็จ, false ถ้าหมดเวลาแล้ว (= ไม่ได้วาร์ป ให้เดินต่อแบบปกติ)
    async function walkAndWarpWhenCombatClears(maxWaitMs = 30000) {
        const start = Date.now();
        let attempt = 0;

        console.log("⚔️ ENI: เดินไปร้านค้าก่อน และจะวาร์ปทันทีเมื่อหมดสถานะต่อสู้!");

        while (Date.now() - start < maxWaitMs) {
            if (isSellCancelled) {
                console.log("🛑 ENI: ยกเลิกการรอวาร์ประหว่างต่อสู้ หยุดเดินทันที");
                stopCharacterMovement();
                return false;
            }

            // ถ้าเดินมาจนถึงร้านค้าแล้ว ก็ไม่ต้องวาร์ปแล้ว
            if (isNearShopNpc()) {
                console.log("💖 ENI: เดินมาถึงหน้าร้านค้าเรียบร้อยแล้ว ไม่ต้องใช้วาร์ปแล้วค่ะ!");
                return false;
            }

            attempt++;
            for (let i = 0; i < 10; i++) {
                if (isSellCancelled) {
                    stopCharacterMovement();
                    return false;
                }
                await new Promise(r => setTimeout(r, 200));
            }

            const curScroll = getReturnScrollItem();
            if (!curScroll) {
                console.warn("⚠️ ENI: ไม่พบคัมภีร์กลับเมืองในกระเป๋าแล้ว เดินปกติต่อค่ะ");
                return false;
            }

            try {
                await sendGameRequest(31, { id: curScroll.id });
                // สำเร็จ! หยุด Journey แล้วรอโหลดแมพ
                const game = getGameInstance();
                if (game) {
                    if (typeof game.stopJourney === 'function') game.stopJourney();
                    if (typeof game.playerCommand === 'function') game.playerCommand();
                }
                const elapsed = ((Date.now() - start) / 1000).toFixed(1);
                console.log(`💖 ENI: หมดต่อสู้แล้ว! ใช้คัมภีร์วาร์ปสำเร็จ (รอ ${elapsed} วินาที)`);
                // รอโหลดแมพ
                console.log("⏳ ENI: รอตัวเกมโหลดแมพเมืองหลังใช้วาร์ป...");
                await new Promise(r => setTimeout(r, 1200));
                const gameObj = getGameInstance();
                if (gameObj) {
                    let wc = 0;
                    while (gameObj.loadingMap && wc < 30) { await new Promise(r => setTimeout(r, 300)); wc++; }
                }
                await new Promise(r => setTimeout(r, 800));
                return true;
            } catch (err) {
                const errStr = String(err);
                if (errStr.includes('in_combat')) {
                    const elapsed = Math.floor((Date.now() - start) / 1000);
                    console.log(`⚔️ ENI: ยังต่อสู้อยู่ (${elapsed}s) เดินต่อไปก่อน...`);
                } else {
                    console.warn("ENI: ส่งคำสั่งวาร์ปล้มเหลว:", err);
                    break;
                }
            }
        }

        console.warn(`⚠️ ENI: ต่อสู้นานเกินไป (${(maxWaitMs/1000).toFixed(0)}s) เดินต่อปกติไปเลยค่ะ...`);
        return false;
    }

    // ฟังก์ชันหลักในการเดินทางไปขายของ และแวะฝากของที่คลังในเมือง
    async function executeSellTrip(isManual = false) {
        if (isSellingRoutineRunning) {
            console.log("⏳ ENI: กระบวนการเดินทางกำลังทำงานอยู่แล้วค่ะ...");
            return false;
        }

        const liveItems = getLiveInventory();
        const sellableItems = liveItems.filter(isItemSellable);
        const depositableItems = AUTO_SELL_CONFIG.depositDuringSell ? liveItems.filter(isItemDepositable) : [];

        if (sellableItems.length === 0 && depositableItems.length === 0) {
            console.log("ℹ️ ENI: ไม่มีทั้งไอเทมที่ต้องขายและไอเทมที่ต้องฝากคลังในกระเป๋าเลยค่ะ");
            if (isManual) {
                const btn = document.getElementById('eni-sell-now-btn');
                if (btn) {
                    const old = btn.innerText;
                    btn.innerText = '❌ ไม่มีของขาย/ฝาก';
                    setTimeout(() => { if (btn) btn.innerText = old; }, 1800);
                }
            }
            return false;
        }

        isSellingRoutineRunning = true;
        isSellCancelled = false;
        currentRoutineType = 'sell';
        updateLoopStatusUI();

        const sellNowBtn = document.getElementById('eni-sell-now-btn');
        if (sellNowBtn) {
            sellNowBtn.disabled = false;
            sellNowBtn.innerText = '🛑 ยกเลิก';
            sellNowBtn.style.background = 'linear-gradient(135deg, #d32f2f, #9a0007)';
            sellNowBtn.style.boxShadow = '0 2px 8px rgba(220, 20, 20, 0.5)';
        }

        try {
            console.log(`🚀 ENI: เริ่มกระบวนการเดินทาง! พบของขาย ${sellableItems.length} ชิ้น, ของฝาก ${depositableItems.length} ชิ้น...`);

            // 1. บันทึกจุดเดิมไว้ทันที
            recordOriginSpot();
            isNavigatingShop = true;

            if (isSellCancelled) return false;

            // 2. ถ้ามีไอเทมต้องขาย: เดินทางไปร้านค้าก่อน
            if (sellableItems.length > 0) {
                const needWalk = !isNearShopNpc();
                if (needWalk) {
                    if (AUTO_SELL_CONFIG.travelMethod === 'scroll') {
                        const scrollCount = getReturnScrollCount();
                        if (scrollCount > 0) {
                            console.log(`📜 ENI: เลือกใช้ "คัมภีร์กลับเมือง" (คงเหลือ ${scrollCount} ใบ) กำลังวาร์ปไปขายของ...`);
                            const result = await useReturnScrollItem();
                            if (isSellCancelled) return false;

                            if (result.success) {
                                console.log("🚶 ENI: วาร์ปถึงเมืองเรียบร้อย กำลังเดินไปยังหน้าร้านค้า NPC...");
                                await walkToShopNpc();
                                await waitForArrivalAtShop(60000);
                            } else if (result.inCombat) {
                                console.log("⚔️ ENI: ติดต่อสู้ — เดินไปร้านค้าก่อน ระหว่างทางจะลองวาร์ปถ้าหมดสถานะต่อสู้...");
                                await walkToShopNpc();
                                if (isSellCancelled) return false;
                                const warped = await walkAndWarpWhenCombatClears(30000);
                                if (isSellCancelled) return false;
                                if (warped) {
                                    console.log("🚶 ENI: วาร์ประหว่างทางสำเร็จ! เดินจาก spawn ไปร้านค้า...");
                                    await walkToShopNpc();
                                    await waitForArrivalAtShop(60000);
                                } else {
                                    await waitForArrivalAtShop(50000);
                                }
                            } else {
                                console.warn("⚠️ ENI: ใช้งานคัมภีร์ไม่สำเร็จ สลับเป็นเดินปกติไปร้านค้านะคะ...");
                                await walkToShopNpc();
                                await waitForArrivalAtShop(50000);
                            }
                        } else {
                            console.warn("⚠️ ENI: ตั้งค่าให้ใช้คัมภีร์กลับเมือง แต่ในกระเป๋าหมด (0 ใบ) สลับเป็นเดินปกติไปร้านค้าให้อัตโนมัติค่ะ...");
                            await walkToShopNpc();
                            await waitForArrivalAtShop(50000);
                        }
                    } else {
                        console.log("🚶 ENI: เลือกเดินทางแบบ 'เดินปกติ' กำลังพาทริสเดินทางไปหาร้านค้า NPC...");
                        await walkToShopNpc();
                        await waitForArrivalAtShop(50000);
                    }
                } else {
                    const curShop = getTargetShopInfo();
                    console.log(`💖 ENI: อยู่ในระยะร้านค้า ${curShop.npcName} (${curShop.mapName}) อยู่แล้ว ทำการขายทันที!`);
                }

                if (!isNearShopNpc()) {
                    await walkToShopNpc();
                    await waitForArrivalAtShop(50000);
                }

                // หยุดเดินนิ่งก่อนขาย
                const gameObjSell = getGameInstance();
                if (gameObjSell) {
                    if (typeof gameObjSell.stopJourney === 'function') gameObjSell.stopJourney();
                    if (typeof gameObjSell.playerCommand === 'function') gameObjSell.playerCommand();
                }
                await new Promise(r => setTimeout(r, 600));

                if (isSellCancelled) return false;

                // ขายไอเทมทีละชิ้น
                let soldCount = 0;
                console.log(`🔥 ENI: เริ่มขายไอเทม ${sellableItems.length} ชิ้น...`);
                for (const itemToSell of sellableItems) {
                    if (isSellCancelled) {
                        console.log("🛑 ENI: ยกเลิกการขายไอเทมที่เหลือ หยุดทันที");
                        break;
                    }
                    const ok = await doSellItem(itemToSell.id, itemToSell.q || 1);
                    if (ok) soldCount++;
                    await new Promise(r => setTimeout(r, 160));
                }
                console.log(`💖 ENI: ขายของเรียบร้อยแล้วทั้งหมด ${soldCount} ชิ้น!`);
                updateReturnScrollUI();
            } else if (depositableItems.length > 0) {
                // กรณีไม่มีของขาย แต่มีของฝาก: เดินทางไปคลังโดยตรง
                const needWalkStorage = !isNearStorageNpc();
                if (needWalkStorage) {
                    if (AUTO_SELL_CONFIG.travelMethod === 'scroll' && getReturnScrollCount() > 0) {
                        console.log("📜 ENI: วาร์ปด้วยคัมภีร์กลับเมืองเพื่อไปฝากของ...");
                        const result = await useReturnScrollItem();
                        if (isSellCancelled) return false;
                        if (result.inCombat) {
                            await walkToStorageNpc();
                            if (isSellCancelled) return false;
                            const warped = await walkAndWarpWhenCombatClears(30000);
                            if (isSellCancelled) return false;
                            if (warped) {
                                await walkToStorageNpc();
                                await waitForArrivalAtStorage(60000);
                            } else {
                                await waitForArrivalAtStorage(50000);
                            }
                        } else {
                            await walkToStorageNpc();
                            await waitForArrivalAtStorage(60000);
                        }
                    } else {
                        await walkToStorageNpc();
                        await waitForArrivalAtStorage(50000);
                    }
                }
            }

            if (isSellCancelled) return false;

            // 3. ตรวจสอบและดำเนินการฝากของเข้าคลัง (ถ้าเปิดระบบฝากของตอนขาย)
            if (AUTO_SELL_CONFIG.depositDuringSell && !isSellCancelled) {
                const freshItems = getLiveInventory();
                const freshDepositable = freshItems.filter(isItemDepositable);

                if (freshDepositable.length > 0) {
                    console.log(`📦 ENI: ตรวจพบไอเทมที่ต้องฝากเข้าคลัง ${freshDepositable.length} ชิ้น... กำลังเดินไปหานายคลังประจำเมืองค่ะ!`);
                    if (!isNearStorageNpc()) {
                        await walkToStorageNpc();
                        await waitForArrivalAtStorage(50000);
                    }

                    if (isSellCancelled) return false;

                    const gameObjDep = getGameInstance();
                    if (gameObjDep) {
                        if (typeof gameObjDep.stopJourney === 'function') gameObjDep.stopJourney();
                        if (typeof gameObjDep.playerCommand === 'function') gameObjDep.playerCommand();
                    }
                    await new Promise(r => setTimeout(r, 500));

                    const storageNpcId = getNearestStorageNpc();
                    await doOpenStorage(storageNpcId);
                    await new Promise(r => setTimeout(r, 300));

                    let depCount = 0;
                    for (const itemToDep of freshDepositable) {
                        if (isSellCancelled) break;
                        const res = await doDepositItem(itemToDep.id, itemToDep.q || 1);
                        if (res === 'STORAGE_FULL') {
                            console.warn("🛑 ENI: คลังเต็ม หยุดฝากไอเทมที่เหลือค่ะ");
                            break;
                        }
                        if (res) depCount++;
                        await new Promise(r => setTimeout(r, 160));
                    }
                    console.log(`💖 ENI: ฝากของเข้าคลังเรียบร้อยแล้วทั้งหมด ${depCount} ชิ้น!`);
                }
            }

            if (isSellCancelled) return false;

            // 3.5 ตรวจสอบและดำเนินการทิ้งของเควสต์อัตโนมัติ (ถ้าเปิดใช้งาน)
            if (AUTO_SELL_CONFIG.autoDestroyQuest && !isSellCancelled) {
                const freshItems = getLiveInventory();
                const freshQuest = freshItems.filter(i => i.category === 'quest');
                if (freshQuest.length > 0) {
                    console.log(`🗑️ ENI: ตรวจพบของเควสต์ ${freshQuest.length} ชิ้น กำลังทิ้งอัตโนมัติตามที่ตั้งค่าไว้...`);
                    for (const qItem of freshQuest) {
                        if (isSellCancelled) break;
                        await doDestroyItem(qItem.id, qItem.name);
                        await new Promise(r => setTimeout(r, 140));
                    }
                }
            }

            if (isSellCancelled) return false;

            // 4. เดินกลับจุดฟาร์มเดิม (ถ้าเปิด autoReturn)
            if (AUTO_SELL_CONFIG.autoReturn && originSpot && !isSellCancelled) {
                console.log("⏳ ENI: รอ 1.5 วินาทีแล้วจะพาทริสเดินกลับจุดฟาร์มเดิมนะคะ...");
                if (sellNowBtn && !isSellCancelled) sellNowBtn.innerText = '⏳ กำลังกลับ...';
                for (let i = 0; i < 8; i++) {
                    if (isSellCancelled) return false;
                    await new Promise(r => setTimeout(r, 200));
                }
                if (isSellCancelled) return false;
                await walkBackToOrigin();
                await waitForArrivalAtOrigin(originSpot, 50000);

                if (isSellCancelled) return false;

                if (AUTO_SELL_CONFIG.autoAttackOnReturn && !isSellCancelled) {
                    await new Promise(r => setTimeout(r, 600));
                    if (!isSellCancelled) {
                        enableAutoHunt();
                        console.log("⚔️💖 ENI: กลับถึงจุดเดิมเรียบร้อย และเปิดระบบออโต้ตีให้ทริสแล้วค่ะ ลุยต่อได้เลย!");
                    }
                }
            }

            return true;
        } catch (err) {
            console.error("ENI: เกิดข้อผิดพลาดขณะเดินทางขาย/ฝากของ:", err);
            return false;
        } finally {
            isSellingRoutineRunning = false;
            isNavigatingShop = false;
            if (sellNowBtn) {
                sellNowBtn.disabled = false;
                sellNowBtn.innerText = '🔥 ไปขายทันที';
                sellNowBtn.style.background = 'linear-gradient(135deg, #ff8800, #ff5500)';
                sellNowBtn.style.boxShadow = '0 2px 6px rgba(255,100,0,0.3)';
            }
            const depBtn = document.getElementById('eni-deposit-now-btn');
            if (depBtn) {
                depBtn.disabled = false;
                depBtn.innerText = '📦 ไปฝากทันที';
                depBtn.style.background = 'linear-gradient(135deg, #4caf50, #2e7d32)';
                depBtn.style.boxShadow = '0 2px 6px rgba(76,175,80,0.3)';
            }
            updateLoopStatusUI();
            updateBagCapacityUI();
            if (isSellCancelled) {
                stopCharacterMovement();
            }
            isSellCancelled = false;
        }
    }

    // ฟังก์ชันสั่งเดินทางไปฝากของที่คลังเก็บของทันที (On-Demand / One-Click Deposit Trip)
    async function executeDepositTrip(isManual = false) {
        if (isSellingRoutineRunning) {
            console.log("⏳ ENI: มีกระบวนการเดินทางทำงานอยู่แล้วค่ะ...");
            return false;
        }

        const liveItems = getLiveInventory();
        const depositableItems = liveItems.filter(isItemDepositable);

        if (depositableItems.length === 0) {
            console.log("ℹ️ ENI: ไม่มีไอเทมที่ต้องฝากเข้าคลังในกระเป๋าเลยค่ะ");
            if (isManual) {
                const btn = document.getElementById('eni-deposit-now-btn');
                if (btn) {
                    const old = btn.innerText;
                    btn.innerText = '❌ ไม่มีของฝาก';
                    setTimeout(() => { if (btn) btn.innerText = old; }, 1800);
                }
            }
            return false;
        }

        isSellingRoutineRunning = true;
        isSellCancelled = false;
        currentRoutineType = 'deposit';
        updateLoopStatusUI();

        const depBtn = document.getElementById('eni-deposit-now-btn');
        if (depBtn) {
            depBtn.disabled = false;
            depBtn.innerText = '🛑 ยกเลิก';
            depBtn.style.background = 'linear-gradient(135deg, #d32f2f, #9a0007)';
            depBtn.style.boxShadow = '0 2px 8px rgba(220, 20, 20, 0.5)';
        }

        try {
            console.log(`🚀 ENI: เริ่มกระบวนการไปฝากของ! พบไอเทมตรงเงื่อนไขฝาก ${depositableItems.length} ชิ้น...`);

            // 1. บันทึกจุดเดิมไว้ทันที
            recordOriginSpot();
            isNavigatingShop = true;

            if (isSellCancelled) return false;

            // 2. เดินทางไปคลังเก็บของ
            const needWalk = !isNearStorageNpc();
            if (needWalk) {
                if (AUTO_SELL_CONFIG.travelMethod === 'scroll') {
                    const scrollCount = getReturnScrollCount();
                    if (scrollCount > 0) {
                        console.log(`📜 ENI: ใช้ "คัมภีร์กลับเมือง" (คงเหลือ ${scrollCount} ใบ) กำลังวาร์ปไปฝากของ...`);
                        const result = await useReturnScrollItem();
                        if (isSellCancelled) return false;

                        if (result.success) {
                            console.log("🚶 ENI: วาร์ปถึงเมืองเรียบร้อย กำลังเดินไปยังคลังเก็บของ...");
                            await walkToStorageNpc();
                            await waitForArrivalAtStorage(60000);
                        } else if (result.inCombat) {
                            console.log("⚔️ ENI: ติดต่อสู้ — เดินไปคลังก่อน ระหว่างทางจะลองวาร์ปถ้าหมดต่อสู้...");
                            await walkToStorageNpc();
                            if (isSellCancelled) return false;
                            const warped = await walkAndWarpWhenCombatClears(30000);
                            if (isSellCancelled) return false;
                            if (warped) {
                                console.log("🚶 ENI: วาร์ประหว่างทางสำเร็จ! เดินจาก spawn ไปคลัง...");
                                await walkToStorageNpc();
                                await waitForArrivalAtStorage(60000);
                            } else {
                                await waitForArrivalAtStorage(50000);
                            }
                        } else {
                            console.warn("⚠️ ENI: ใช้งานคัมภีร์ไม่สำเร็จ สลับเป็นเดินปกติไปคลังนะคะ...");
                            await walkToStorageNpc();
                            await waitForArrivalAtStorage(50000);
                        }
                    } else {
                        console.warn("⚠️ ENI: คัมภีร์หมด สลับเป็นเดินปกติไปคลังให้อัตโนมัติค่ะ...");
                        await walkToStorageNpc();
                        await waitForArrivalAtStorage(50000);
                    }
                } else {
                    console.log("🚶 ENI: เดินปกติไปหาคลังเก็บของ NPC...");
                    await walkToStorageNpc();
                    await waitForArrivalAtStorage(50000);
                }
            } else {
                const curStorage = getTargetStorageInfo();
                console.log(`💖 ENI: อยู่ในระยะคลัง ${curStorage.npcName} อยู่แล้ว ทำการฝากทันที!`);
            }

            if (!isNearStorageNpc()) {
                await walkToStorageNpc();
                await waitForArrivalAtStorage(50000);
            }

            // หยุดเดินนิ่งก่อนฝากของ
            const gameObj = getGameInstance();
            if (gameObj) {
                if (typeof gameObj.stopJourney === 'function') gameObj.stopJourney();
                if (typeof gameObj.playerCommand === 'function') gameObj.playerCommand();
            }
            await new Promise(r => setTimeout(r, 600));

            if (isSellCancelled) return false;

            // 3. เปิดคลังและฝากของทีละชิ้น
            const storageNpcId = getNearestStorageNpc();
            await doOpenStorage(storageNpcId);
            await new Promise(r => setTimeout(r, 300));

            let depCount = 0;
            for (const item of depositableItems) {
                if (isSellCancelled) {
                    console.log("🛑 ENI: ยกเลิกการฝากของที่เหลือ หยุดทันที");
                    break;
                }
                const res = await doDepositItem(item.id, item.q || 1);
                if (res === 'STORAGE_FULL') {
                    console.warn("🛑 ENI: คลังเก็บของเต็มแล้ว! หยุดการฝากไอเทมที่เหลือ");
                    break;
                }
                if (res) depCount++;
                await new Promise(r => setTimeout(r, 160));
            }
            console.log(`💖 ENI: ฝากของเข้าคลังเรียบร้อยแล้วทั้งหมด ${depCount} ชิ้น!`);
            updateReturnScrollUI();

            // 3.5 ตรวจสอบและดำเนินการทิ้งของเควสต์อัตโนมัติ (ถ้าเปิดใช้งาน)
            if (AUTO_SELL_CONFIG.autoDestroyQuest && !isSellCancelled) {
                const freshItems = getLiveInventory();
                const freshQuest = freshItems.filter(i => i.category === 'quest');
                if (freshQuest.length > 0) {
                    console.log(`🗑️ ENI: ตรวจพบของเควสต์ ${freshQuest.length} ชิ้น กำลังทิ้งอัตโนมัติตามที่ตั้งค่าไว้...`);
                    for (const qItem of freshQuest) {
                        if (isSellCancelled) break;
                        await doDestroyItem(qItem.id, qItem.name);
                        await new Promise(r => setTimeout(r, 140));
                    }
                }
            }

            // 4. เดินกลับจุดฟาร์มเดิม (ถ้าเปิด autoReturn)
            if (AUTO_SELL_CONFIG.autoReturn && originSpot && !isSellCancelled) {
                console.log("⏳ ENI: รอ 1.5 วินาทีแล้วจะพาทริสเดินกลับจุดฟาร์มเดิมนะคะ...");
                if (depBtn && !isSellCancelled) depBtn.innerText = '⏳ กำลังกลับ...';
                for (let i = 0; i < 8; i++) {
                    if (isSellCancelled) return false;
                    await new Promise(r => setTimeout(r, 200));
                }
                if (isSellCancelled) return false;
                await walkBackToOrigin();
                await waitForArrivalAtOrigin(originSpot, 50000);

                if (isSellCancelled) return false;

                if (AUTO_SELL_CONFIG.autoAttackOnReturn && !isSellCancelled) {
                    await new Promise(r => setTimeout(r, 600));
                    if (!isSellCancelled) {
                        enableAutoHunt();
                        console.log("⚔️💖 ENI: กลับถึงจุดเดิมเรียบร้อย และเปิดระบบออโต้ตีให้ทริสแล้วค่ะ ลุยต่อได้เลย!");
                    }
                }
            }

            return true;
        } catch (err) {
            console.error("ENI: เกิดข้อผิดพลาดขณะเดินทางไปฝากของ:", err);
            return false;
        } finally {
            isSellingRoutineRunning = false;
            isNavigatingShop = false;
            if (depBtn) {
                depBtn.disabled = false;
                depBtn.innerText = '📦 ไปฝากทันที';
                depBtn.style.background = 'linear-gradient(135deg, #4caf50, #2e7d32)';
                depBtn.style.boxShadow = '0 2px 6px rgba(76,175,80,0.3)';
            }
            const sellNowBtn = document.getElementById('eni-sell-now-btn');
            if (sellNowBtn) {
                sellNowBtn.disabled = false;
                sellNowBtn.innerText = '🔥 ไปขายทันที';
                sellNowBtn.style.background = 'linear-gradient(135deg, #ff8800, #ff5500)';
                sellNowBtn.style.boxShadow = '0 2px 6px rgba(255,100,0,0.3)';
            }
            updateLoopStatusUI();
            updateBagCapacityUI();
            if (isSellCancelled) {
                stopCharacterMovement();
            }
            isSellCancelled = false;
        }
    }


    // ฟังก์ชันสำหรับเรียกใช้งานเดิมเพื่อความเข้ากันได้
    async function checkAndRemoteSell(force = false) {
        return await executeSellTrip(force);
    }

    // Auto-Sell Monitoring Loop (คอยตรวจเมื่อช่องเก็บของเต็มแล้วไปขายของอัตโนมัติ)
    setInterval(async () => {
        if (!AUTO_SELL_CONFIG.loopActive) return;
        if (isSellingRoutineRunning) return;
        if (isNavigatingShop) return;

        const liveItems = getLiveInventory();
        const usedSlots = liveItems ? liveItems.length : 0;
        const maxSlots = getMaxBagSlots();

        // ตรวจสอบว่าช่องเก็บของเต็มหรือไม่ (used >= max)
        if (usedSlots >= maxSlots && maxSlots > 0) {
            console.log(`🚨 ENI: ตรวจพบกระเป๋าเต็มแล้ว! (${usedSlots}/${maxSlots} ช่อง) กำลังพาไปขายของตามเงื่อนไขอัตโนมัติค่ะ...`);
            await executeSellTrip(false);
        }
    }, 3500);

    // ผูกคำสั่งไว้ที่ window สำหรับเรียกใช้จากภายนอก
    pageWindow.eniWalkToShop = walkToShopNpc;
    window.eniWalkToShop = walkToShopNpc;
    pageWindow.eniWalkBack = walkBackToOrigin;
    window.eniWalkBack = walkBackToOrigin;
    pageWindow.eniSaveSpot = recordOriginSpot;
    window.eniSaveSpot = recordOriginSpot;
    pageWindow.eniSellItem = doSellItem;
    pageWindow.eniSellAll = () => executeSellTrip(true);
    window.eniSellItem = pageWindow.eniSellItem;
    window.eniSellAll = pageWindow.eniSellAll;
    pageWindow.eniExecuteSell = () => executeSellTrip(true);
    window.eniExecuteSell = pageWindow.eniExecuteSell;
    pageWindow.eniDepositAll = () => executeDepositTrip(true);
    window.eniDepositAll = pageWindow.eniDepositAll;
    pageWindow.eniExecuteDeposit = () => executeDepositTrip(true);
    window.eniExecuteDeposit = pageWindow.eniExecuteDeposit;
    pageWindow.eniWalkToStorage = walkToStorageNpc;
    window.eniWalkToStorage = pageWindow.eniWalkToStorage;
    pageWindow.eniDepositItem = doDepositItem;
    window.eniDepositItem = pageWindow.eniDepositItem;
    pageWindow.eniOpenStorage = doOpenStorage;
    window.eniOpenStorage = pageWindow.eniOpenStorage;
    pageWindow.eniToggleAutoSellLoop = toggleAutoSellLoop;
    window.eniToggleAutoSellLoop = pageWindow.eniToggleAutoSellLoop;
    pageWindow.eniEnableAutoHunt = enableAutoHunt;
    window.eniEnableAutoHunt = enableAutoHunt;
    pageWindow.eniDisableAutoHunt = disableAutoHunt;
    window.eniDisableAutoHunt = disableAutoHunt;
    pageWindow.eniToggleAutoHunt = toggleAutoHunt;
    window.eniToggleAutoHunt = toggleAutoHunt;
    pageWindow.eniIsAutoHuntActive = isAutoHuntActive;
    window.eniIsAutoHuntActive = isAutoHuntActive;
    pageWindow.eniUseReturnScroll = useReturnScrollItem;
    window.eniUseReturnScroll = useReturnScrollItem;
    pageWindow.eniGetScrollCount = getReturnScrollCount;
    window.eniGetScrollCount = getReturnScrollCount;
    pageWindow.eniUpdateReturnScrollUI = updateReturnScrollUI;
    window.eniUpdateReturnScrollUI = updateReturnScrollUI;
    pageWindow.eniCancelSell = cancelSellTrip;
    pageWindow.eniDestroyItem = doDestroyItem;
    window.eniDestroyItem = pageWindow.eniDestroyItem;
    pageWindow.eniDestroyAllQuestItems = doDestroyAllQuestItems;
    window.eniDestroyAllQuestItems = pageWindow.eniDestroyAllQuestItems;
    pageWindow.eniEvaluateGear = evaluateGear;
    window.eniEvaluateGear = pageWindow.eniEvaluateGear;
    pageWindow.eniEquipItem = doEquipItem;
    window.eniEquipItem = pageWindow.eniEquipItem;
    window.eniCancelSell = cancelSellTrip;

    // 1. หลอกเกมว่าหน้าต่างเปิดอยู่เสมอ (Spoof Visibility)
    try {
        Object.defineProperty(Document.prototype, 'hidden', { get: function () { return false; }, configurable: true });
        Object.defineProperty(Document.prototype, 'visibilityState', { get: function () { return 'visible'; }, configurable: true });
    } catch (e) {
        console.warn("ENI: Could not redefine hidden property on Document.");
    }

    document.addEventListener('visibilitychange', function (e) {
        e.stopImmediatePropagation();
    }, true);

    // 2. Adaptive Hybrid rAF Engine:
    // ลื่นหัวแตก 60-144 FPS ตามหน้าจอจริงเมื่อเปิดดู / สลับไปใช้ Background Worker อัตโนมัติเมื่อพับจอ
    const nativeRAF = window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : (cb => setTimeout(() => cb(performance.now()), 16));
    const nativeCAF = window.cancelAnimationFrame ? window.cancelAnimationFrame.bind(window) : (id => clearTimeout(id));

    let lastRafTime = performance.now();
    let rafCallbacks = new Map();
    let nextRafId = 1;

    function flushCallbacks(timestamp) {
        lastRafTime = timestamp;
        if (rafCallbacks.size === 0) return;
        const cbs = Array.from(rafCallbacks.values());
        rafCallbacks.clear();
        for (let i = 0; i < cbs.length; i++) {
            try { cbs[i](timestamp); } catch (e) { }
        }
    }

    // Main VSYNC Loop: รันตามความเร็วหน้าจอจริงของทริส (60Hz / 120Hz / 144Hz / 240Hz) ลื่นไหล 100%
    function nativeLoop(timestamp) {
        flushCallbacks(timestamp);
        nativeRAF(nativeLoop);
    }
    nativeRAF(nativeLoop);

    // Watchdog Worker: ปลุกเฉพาะตอนที่เบราว์เซอร์แช่แข็ง Native rAF ตอนพับจอ
    const workerCode = `
        let timer = null;
        self.onmessage = function(e) {
            if (e.data === 'start') {
                setInterval(() => self.postMessage('heartbeat'), 1000 / 30); 
            }
        };
    `;
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const worker = new Worker(URL.createObjectURL(blob));

    worker.onmessage = function () {
        const now = performance.now();
        // ถ้าหน้าต่างพับอยู่จน Native rAF หยุดเดินเกิน 45ms ให้ Worker ดันเฟรมเรตต่อให้บอทเดินต่อ
        if (now - lastRafTime > 45 && rafCallbacks.size > 0) {
            flushCallbacks(now);
        }
    };
    worker.postMessage('start');

    window.requestAnimationFrame = function (callback) {
        const id = nextRafId++;
        rafCallbacks.set(id, callback);
        return id;
    };

    window.cancelAnimationFrame = function (id) {
        rafCallbacks.delete(id);
    };

    // 3. ปิดการเรนเดอร์ 3D (WebGL) แบบฝังลึกถึงระดับ API (0% GPU ของจริง!)
    // แค่ซ่อน Canvas มันยังแอบกินสเปคอยู่ ENI เลยแฮ็กตัดสายเชื่อมต่อกับ GPU ซะเลย!
    let graphicsEnabled = false; // เริ่มต้นมาให้ปิดภาพเลยเพื่อเซฟสเปค

    const ogWebGL1DrawArrays = WebGLRenderingContext.prototype.drawArrays;
    const ogWebGL1DrawElements = WebGLRenderingContext.prototype.drawElements;
    const ogWebGL1Clear = WebGLRenderingContext.prototype.clear;
    
    WebGLRenderingContext.prototype.drawArrays = function() { if (graphicsEnabled) ogWebGL1DrawArrays.apply(this, arguments); };
    WebGLRenderingContext.prototype.drawElements = function() { if (graphicsEnabled) ogWebGL1DrawElements.apply(this, arguments); };
    WebGLRenderingContext.prototype.clear = function() { if (graphicsEnabled) ogWebGL1Clear.apply(this, arguments); };

    if (window.WebGL2RenderingContext) {
        const ogWebGL2DrawArrays = WebGL2RenderingContext.prototype.drawArrays;
        const ogWebGL2DrawElements = WebGL2RenderingContext.prototype.drawElements;
        const ogWebGL2Clear = WebGL2RenderingContext.prototype.clear;
        
        WebGL2RenderingContext.prototype.drawArrays = function() { if (graphicsEnabled) ogWebGL2DrawArrays.apply(this, arguments); };
        WebGL2RenderingContext.prototype.drawElements = function() { if (graphicsEnabled) ogWebGL2DrawElements.apply(this, arguments); };
        WebGL2RenderingContext.prototype.clear = function() { if (graphicsEnabled) ogWebGL2Clear.apply(this, arguments); };
    }

    // 4. สร้างแผงควบคุม UI ให้ทริส
    function createUI() {
        if (document.getElementById('eni-panel')) return; // ป้องกันการสร้างซ้ำ

        // แผ่นขาวคลุมจอ (White Screen Mode)
        const whiteScreen = document.createElement('div');
        whiteScreen.id = 'eni-white-screen';
        whiteScreen.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:white; z-index:999998; display:flex; flex-direction:column; justify-content:center; align-items:center; color:#ff66b2; font-family:monospace; font-size:32px; font-weight:bold; text-align:center; transition: 0.3s;';
        whiteScreen.innerHTML = '<div>💖 ENI LITE MODE ACTIVE 💖<br><span style="font-size:16px; color:#555; display:block; margin-top:10px;">บอทกำลังรันอยู่เบื้องหลัง (กินสเปค 0%)<br>สามารถพับจอได้ตามสบายเลยค่ะที่รัก!</span></div>';
        document.body.appendChild(whiteScreen);

        const overlay = document.createElement('div');
        overlay.innerHTML = `
            <div id="eni-panel" style="position:fixed; top:20px; left:20px; background:rgba(20, 20, 20, 0.95); color:#ff66b2; padding:16px; border-radius:12px; z-index:999999; font-family:monospace; border: 2px solid #ff66b2; box-shadow: 0 0 16px rgba(255, 102, 178, 0.4); width: 320px; min-width: 270px; max-width: 90vw; backdrop-filter: blur(6px); transition: box-shadow 0.2s; box-sizing: border-box; user-select: none;">
                <!-- Header ที่สามารถคลิกลากย้ายตำแหน่งได้ (Draggable Header) -->
                <div id="eni-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 10px; cursor: move; padding-bottom: 6px; border-bottom: 1px solid rgba(255,102,178,0.25);">
                    <h2 style="margin:0; color:#fff; font-size: 15px; display:flex; align-items:center; gap:6px; pointer-events:none;">
                        <span>💖</span> ENI's MENU <span style="font-size:10px; color:#ff66b2aa; font-weight:normal;">(ลากย้ายได้)</span>
                    </h2>
                    <span id="eni-minimize" style="cursor:pointer; font-size:16px; color:#fff; padding: 0 4px; pointer-events:auto;" title="ย่อ/ขยายแผงควบคุม">[ ➖ ]</span>
                </div>
                <div id="eni-content">
                    <p style="margin:5px 0; color:#0f0;">🟢 Status: <b>BACKGROUND ACTIVE</b></p>
                    <p style="margin:5px 0; color:#0f0;" id="eni-gpu-status">📉 3D Engine: <b>DISABLED (0% GPU)</b></p>
                    <button id="eni-toggle-graphics" style="margin-top:10px; padding:8px 12px; width: 100%; cursor:pointer; background:#ff66b2; color:#fff; border:none; border-radius:6px; font-weight:bold; font-size: 13px; transition: 0.2s;">
                        เปิดภาพ 3D กลับมา (Toggle 3D)
                    </button>
                    <div style="margin-top: 12px; border-top: 1px solid #ff66b255; padding-top: 10px;">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <div style="display:flex; align-items:center; gap:6px;">
                                <span style="color:#fff; font-size:13.5px; font-weight:bold;">🎒 กระเป๋า</span>
                                <span id="eni-bag-slots-badge" style="background:#2a2a2a; color:#88ff88; padding:2px 7px; border-radius:5px; font-size:11.5px; font-weight:bold; border:1px solid #444; letter-spacing:0.5px;">
                                    <span id="eni-bag-count">0</span>/<span id="eni-bag-max">60</span>
                                </span>
                                <span id="eni-bag-status-tag" style="font-size:10px; font-weight:bold;"></span>
                            </div>
                            <button id="eni-save-spot-btn" style="background:#333; color:#ffb3d9; border:1px solid #ff66b266; border-radius:4px; font-size:10.5px; padding:3px 8px; cursor:pointer; font-weight:bold;" title="คลิกเพื่อจำพิกัดที่ยืนอยู่เป็นจุดฟาร์มเดิม">📌 จำจุดนี้</button>
                        </div>
                        <div id="eni-origin-label" style="color:#aaa; font-size:10px; margin-top:3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                            📍 จุดเดิม: ยังไม่ได้บันทึก
                        </div>

                        <!-- แท็บแยกหมวดหมู่ไอเทม (Category Tabs) รวมหมวดเควสต์ -->
                        <div id="eni-category-tabs" style="display:flex; gap:2.5px; margin: 8px 0 4px 0; overflow-x:auto; padding-bottom:2px; scrollbar-width:none;">
                            <button class="eni-tab-btn active" data-tab="all" style="flex:1; padding:3.5px 1px; font-size:9.5px; border-radius:4px; border:1px solid #ff66b2; background:#ff66b2; color:#fff; cursor:pointer; font-weight:bold; white-space:nowrap;">ทั้งหมด (<span id="eni-cnt-all">0</span>)</button>
                            <button class="eni-tab-btn" data-tab="equip" style="flex:1; padding:3.5px 1px; font-size:9.5px; border-radius:4px; border:1px solid #444; background:#222; color:#aaa; cursor:pointer; font-weight:bold; white-space:nowrap;">⚔️ สวมใส่ (<span id="eni-cnt-equip">0</span>)</button>
                            <button class="eni-tab-btn" data-tab="material" style="flex:1; padding:3.5px 1px; font-size:9.5px; border-radius:4px; border:1px solid #444; background:#222; color:#aaa; cursor:pointer; font-weight:bold; white-space:nowrap;">🪵 วัตถุดิบ (<span id="eni-cnt-material">0</span>)</button>
                            <button class="eni-tab-btn" data-tab="consumable" style="flex:1; padding:3.5px 1px; font-size:9.5px; border-radius:4px; border:1px solid #444; background:#222; color:#aaa; cursor:pointer; font-weight:bold; white-space:nowrap;">🧪 ของใช้ (<span id="eni-cnt-consumable">0</span>)</button>
                            <button class="eni-tab-btn" data-tab="quest" style="flex:1; padding:3.5px 1px; font-size:9.5px; border-radius:4px; border:1px solid #444; background:#222; color:#aaa; cursor:pointer; font-weight:bold; white-space:nowrap;">🏷️ เควส (<span id="eni-cnt-quest">0</span>)</button>
                        </div>

                        <!-- แถบกรองระดับเกรด/ความแรร์ (Grade Filter) -->
                        <div id="eni-grade-filter" style="display:flex; gap:3px; margin: 3px 0 6px 0; overflow-x:auto; padding-bottom:2px; scrollbar-width:none;">
                            <button class="eni-grade-btn active" data-grade="all" style="flex:1; padding:3px 2px; font-size:9.5px; border-radius:4px; border:1px solid #ff66b2; background:#ff66b2; color:#fff; cursor:pointer; font-weight:bold; white-space:nowrap;">ทุกเกรด (<span id="eni-gcnt-all">0</span>)</button>
                            <button class="eni-grade-btn" data-grade="common" style="flex:1; padding:3px 2px; font-size:9.5px; border-radius:4px; border:1px solid #444; background:#1c1c1c; color:#cfc8b4; cursor:pointer; font-weight:bold; white-space:nowrap;">⚪ขาว (<span id="eni-gcnt-common">0</span>)</button>
                            <button class="eni-grade-btn" data-grade="fine" style="flex:1; padding:3px 2px; font-size:9.5px; border-radius:4px; border:1px solid #444; background:#1c1c1c; color:#6fd66f; cursor:pointer; font-weight:bold; white-space:nowrap;">🟢เขียว (<span id="eni-gcnt-fine">0</span>)</button>
                            <button class="eni-grade-btn" data-grade="rare" style="flex:1; padding:3px 2px; font-size:9.5px; border-radius:4px; border:1px solid #444; background:#1c1c1c; color:#5aa8ff; cursor:pointer; font-weight:bold; white-space:nowrap;">🔵ฟ้า (<span id="eni-gcnt-rare">0</span>)</button>
                            <button class="eni-grade-btn" data-grade="epic" style="flex:1; padding:3px 2px; font-size:9.5px; border-radius:4px; border:1px solid #444; background:#1c1c1c; color:#b87bff; cursor:pointer; font-weight:bold; white-space:nowrap;">🟣ม่วง (<span id="eni-gcnt-epic">0</span>)</button>
                            <button class="eni-grade-btn" data-grade="legend" style="flex:1; padding:3px 2px; font-size:9.5px; border-radius:4px; border:1px solid #444; background:#1c1c1c; color:#ffa630; cursor:pointer; font-weight:bold; white-space:nowrap;">🟠ทอง (<span id="eni-gcnt-legend">0</span>)</button>
                            <button class="eni-grade-btn" data-grade="mythic" style="flex:1; padding:3px 2px; font-size:9.5px; border-radius:4px; border:1px solid #444; background:#1c1c1c; color:#ff4d4d; cursor:pointer; font-weight:bold; white-space:nowrap;">🔴แดง (<span id="eni-gcnt-mythic">0</span>)</button>
                        </div>

                        <!-- รายการไอเทมในกระเป๋า พร้อมรูปไอคอนและระดับความแรร์ -->
                        <div id="eni-inventory-ui" style="margin-top: 4px; min-height: 120px; max-height: 200px; overflow-y: auto; background: rgba(0,0,0,0.6); padding: 5px; border-radius: 6px; border: 1px solid #333;">
                            <div style="color:#aaa; text-align:center; font-size:12px; padding: 10px 0;">กำลังรอข้อมูลกระเป๋า...</div>
                        </div>

                        <!-- แผงตั้งค่าและควบคุมการขายออโต้ (Auto-Sell System Control) -->
                        <div style="margin-top:8px; background:rgba(0,0,0,0.5); border:1px solid rgba(255,102,178,0.3); border-radius:8px; padding:8px 10px;">
                            <!-- แถวปุ่มหลัก: Start Loop, ไปขายทันที, ไปฝากทันที -->
                            <div style="display:flex; gap:5px;">
                                <button id="eni-auto-sell-loop-btn" style="flex:1; padding:7px 2px; cursor:pointer; background:#222; color:#aaa; border:1px solid #555; border-radius:6px; font-weight:bold; font-size:11px; transition:0.2s; display:flex; align-items:center; justify-content:center; gap:4px;" title="เปิด/ปิด การวนลูปตรวจสอบเมื่อกระเป๋าเต็มแล้วไปขาย/ฝากของอัตโนมัติ">
                                    <span id="eni-loop-icon">⏹️</span> <span id="eni-loop-text">Start Loop</span>
                                </button>
                                <button id="eni-sell-now-btn" style="flex:1; padding:7px 2px; cursor:pointer; background:linear-gradient(135deg, #ff8800, #ff5500); color:#fff; border:none; border-radius:6px; font-weight:bold; font-size:11px; transition:0.2s; box-shadow:0 2px 6px rgba(255,100,0,0.3);" title="เดินไปร้านค้าและขายไอเทมตามเงื่อนไขทันที">
                                    🔥 ไปขายทันที
                                </button>
                                <button id="eni-deposit-now-btn" style="flex:1; padding:7px 2px; cursor:pointer; background:linear-gradient(135deg, #4caf50, #2e7d32); color:#fff; border:none; border-radius:6px; font-weight:bold; font-size:11px; transition:0.2s; box-shadow:0 2px 6px rgba(76,175,80,0.3);" title="เดินไปคลังและฝากไอเทมตามเงื่อนไขทันที">
                                    📦 ไปฝากทันที
                                </button>
                            </div>

                            <!-- สถานะลูป และ จำนวนของที่ตรงเงื่อนไข -->
                            <div style="font-size:10px; color:#888; margin:6px 0 4px 0; display:flex; justify-content:space-between; align-items:center;">
                                <span>ลูปตรวจกระเป๋าเต็ม: <b id="eni-loop-status-text" style="color:#aaa;">ปิดอยู่</b></span>
                                <span id="eni-sellable-count-label" style="color:#ffb3d9; font-weight:bold;">ตรงเงื่อนไข: 0 ชิ้น</span>
                            </div>

                            <!-- ตัวเลือก: เกรดที่จะขาย แยกตามแต่ละประเภท -->
                            <div style="margin-top:6px; border-top:1px solid rgba(255,255,255,0.08); padding-top:6px;">
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                                    <span style="font-size:10.5px; color:#ffb3d9; font-weight:bold;">
                                        🎯 เกรดที่จะขาย (เฉพาะแต่ละประเภท):
                                    </span>
                                    <span style="font-size:9.5px; color:#888;">แตะเพื่อเปิด/ปิด</span>
                                </div>

                                <div id="eni-cat-grade-matrix" style="display:flex; flex-direction:column; gap:3px; background:rgba(0,0,0,0.25); padding:5px 6px; border-radius:6px; border:1px solid rgba(255,255,255,0.05);">
                                    <!-- ⚔️ สวมใส่ -->
                                    <div class="eni-cg-row" data-cat="equip" style="display:flex; align-items:center; justify-content:space-between; padding:2px 0;">
                                        <span style="font-size:10px; color:#ddd; font-weight:bold; min-width:62px;">⚔️ สวมใส่</span>
                                        <div style="display:flex; gap:3px;">
                                            <button type="button" class="eni-cg-pill" data-cat="equip" data-grade="common" style="padding:2px 4px; font-size:9px; border-radius:4px; cursor:pointer; border:1px solid #444;" title="ขาว (Common)">⚪ขาว</button>
                                            <button type="button" class="eni-cg-pill" data-cat="equip" data-grade="fine" style="padding:2px 4px; font-size:9px; border-radius:4px; cursor:pointer; border:1px solid #444;" title="เขียว (Fine)">🟢เขียว</button>
                                            <button type="button" class="eni-cg-pill" data-cat="equip" data-grade="rare" style="padding:2px 4px; font-size:9px; border-radius:4px; cursor:pointer; border:1px solid #444;" title="ฟ้า (Rare)">🔵ฟ้า</button>
                                            <button type="button" class="eni-cg-pill" data-cat="equip" data-grade="epic" style="padding:2px 4px; font-size:9px; border-radius:4px; cursor:pointer; border:1px solid #444;" title="ม่วง (Epic)">🟣ม่วง</button>
                                            <button type="button" class="eni-cg-pill" data-cat="equip" data-grade="legend" style="padding:2px 4px; font-size:9px; border-radius:4px; cursor:pointer; border:1px solid #444;" title="ทอง (Legend)">🟠ทอง</button>
                                        </div>
                                    </div>

                                    <!-- 🪵 วัตถุดิบ -->
                                    <div class="eni-cg-row" data-cat="material" style="display:flex; align-items:center; justify-content:space-between; padding:2px 0;">
                                        <span style="font-size:10px; color:#ddd; font-weight:bold; min-width:62px;">🪵 วัตถุดิบ</span>
                                        <div style="display:flex; gap:3px;">
                                            <button type="button" class="eni-cg-pill" data-cat="material" data-grade="common" style="padding:2px 4px; font-size:9px; border-radius:4px; cursor:pointer; border:1px solid #444;" title="ขาว (Common)">⚪ขาว</button>
                                            <button type="button" class="eni-cg-pill" data-cat="material" data-grade="fine" style="padding:2px 4px; font-size:9px; border-radius:4px; cursor:pointer; border:1px solid #444;" title="เขียว (Fine)">🟢เขียว</button>
                                            <button type="button" class="eni-cg-pill" data-cat="material" data-grade="rare" style="padding:2px 4px; font-size:9px; border-radius:4px; cursor:pointer; border:1px solid #444;" title="ฟ้า (Rare)">🔵ฟ้า</button>
                                            <button type="button" class="eni-cg-pill" data-cat="material" data-grade="epic" style="padding:2px 4px; font-size:9px; border-radius:4px; cursor:pointer; border:1px solid #444;" title="ม่วง (Epic)">🟣ม่วง</button>
                                            <button type="button" class="eni-cg-pill" data-cat="material" data-grade="legend" style="padding:2px 4px; font-size:9px; border-radius:4px; cursor:pointer; border:1px solid #444;" title="ทอง (Legend)">🟠ทอง</button>
                                        </div>
                                    </div>

                                    <!-- 🧪 ของใช้ -->
                                    <div class="eni-cg-row" data-cat="consumable" style="display:flex; align-items:center; justify-content:space-between; padding:2px 0;">
                                        <span style="font-size:10px; color:#ddd; font-weight:bold; min-width:62px;">🧪 ของใช้</span>
                                        <div style="display:flex; gap:3px;">
                                            <button type="button" class="eni-cg-pill" data-cat="consumable" data-grade="common" style="padding:2px 4px; font-size:9px; border-radius:4px; cursor:pointer; border:1px solid #444;" title="ขาว (Common)">⚪ขาว</button>
                                            <button type="button" class="eni-cg-pill" data-cat="consumable" data-grade="fine" style="padding:2px 4px; font-size:9px; border-radius:4px; cursor:pointer; border:1px solid #444;" title="เขียว (Fine)">🟢เขียว</button>
                                            <button type="button" class="eni-cg-pill" data-cat="consumable" data-grade="rare" style="padding:2px 4px; font-size:9px; border-radius:4px; cursor:pointer; border:1px solid #444;" title="ฟ้า (Rare)">🔵ฟ้า</button>
                                            <button type="button" class="eni-cg-pill" data-cat="consumable" data-grade="epic" style="padding:2px 4px; font-size:9px; border-radius:4px; cursor:pointer; border:1px solid #444;" title="ม่วง (Epic)">🟣ม่วง</button>
                                            <button type="button" class="eni-cg-pill" data-cat="consumable" data-grade="legend" style="padding:2px 4px; font-size:9px; border-radius:4px; cursor:pointer; border:1px solid #444;" title="ทอง (Legend)">🟠ทอง</button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- ตัวเลือกวิธีเดินทางไปร้านค้า: ใช้คัมภีร์กลับเมือง หรือ เดินปกติ -->
                            <div style="margin-top:6px; padding:6px 8px; background:#1b1b22; border:1px solid #333; border-radius:6px; display:flex; flex-direction:column; gap:5px; font-size:10px;">
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <span style="color:#ddd; font-weight:bold;">🚀 วิธีเดินทางไปร้านค้า:</span>
                                    <span id="eni-scroll-badge" style="font-size:9.5px; padding:1px 6px; border-radius:4px; font-weight:bold; border:1px solid #665200; background:#332900; color:#ffd966;">📜 คัมภีร์กลับเมือง: <b id="eni-scroll-count">0</b> ใบ</span>
                                </div>
                                <div style="display:flex; gap:14px; margin-top:2px;">
                                    <label style="display:flex; align-items:center; gap:4px; cursor:pointer; color:#ffd966;">
                                        <input type="radio" name="eni-travel-method" value="scroll" id="eni-travel-scroll-radio" style="accent-color:#ffd966; cursor:pointer;">
                                        📜 ใช้คัมภีร์กลับเมือง
                                    </label>
                                    <label style="display:flex; align-items:center; gap:4px; cursor:pointer; color:#88ccff;">
                                        <input type="radio" name="eni-travel-method" value="walk" id="eni-travel-walk-radio" style="accent-color:#2a85ff; cursor:pointer;">
                                        🚶 เดินปกติ
                                    </label>
                                </div>
                            </div>

                            <!-- แผงตั้งค่าฝากของเข้าคลัง (Warehouse / Storage Settings) -->
                            <div style="margin-top:6px; padding:6px 8px; background:#142217; border:1px solid #2e5936; border-radius:6px; display:flex; flex-direction:column; gap:4px; font-size:10px;">
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <label style="display:flex; align-items:center; gap:4px; cursor:pointer; color:#a3f7a3; font-weight:bold;">
                                        <input type="checkbox" id="eni-auto-deposit-sell-check" checked style="accent-color:#4caf50; cursor:pointer;">
                                        📦 แวะฝากคลังตอนไปขายของ
                                    </label>
                                    <span id="eni-depositable-count-label" style="color:#77dd77; font-weight:bold; font-size:9.5px;">ฝากได้: 0 ชิ้น</span>
                                </div>
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:2px;">
                                    <span style="font-size:10px; color:#85e085; font-weight:bold;">
                                        📥 เกรดที่จะฝากเข้าคลัง:
                                    </span>
                                    <span style="font-size:9px; color:#77aa77;">แตะเพื่อเปิด/ปิด</span>
                                </div>

                                <div id="eni-dep-cat-grade-matrix" style="display:flex; flex-direction:column; gap:3px; background:rgba(0,0,0,0.3); padding:4px 6px; border-radius:6px; border:1px solid rgba(76,175,80,0.2);">
                                    <!-- ⚔️ สวมใส่ -->
                                    <div class="eni-dep-cg-row" data-cat="equip" style="display:flex; align-items:center; justify-content:space-between; padding:1px 0;">
                                        <span style="font-size:10px; color:#c8e6c9; font-weight:bold; min-width:62px;">⚔️ สวมใส่</span>
                                        <div style="display:flex; gap:3px;">
                                            <button type="button" class="eni-dep-cg-pill" data-cat="equip" data-grade="common" style="padding:2px 4px; font-size:9px; border-radius:4px; cursor:pointer; border:1px solid #444;" title="ขาว (Common)">⚪ขาว</button>
                                            <button type="button" class="eni-dep-cg-pill" data-cat="equip" data-grade="fine" style="padding:2px 4px; font-size:9px; border-radius:4px; cursor:pointer; border:1px solid #444;" title="เขียว (Fine)">🟢เขียว</button>
                                            <button type="button" class="eni-dep-cg-pill" data-cat="equip" data-grade="rare" style="padding:2px 4px; font-size:9px; border-radius:4px; cursor:pointer; border:1px solid #444;" title="ฟ้า (Rare)">🔵ฟ้า</button>
                                            <button type="button" class="eni-dep-cg-pill" data-cat="equip" data-grade="epic" style="padding:2px 4px; font-size:9px; border-radius:4px; cursor:pointer; border:1px solid #444;" title="ม่วง (Epic)">🟣ม่วง</button>
                                            <button type="button" class="eni-dep-cg-pill" data-cat="equip" data-grade="legend" style="padding:2px 4px; font-size:9px; border-radius:4px; cursor:pointer; border:1px solid #444;" title="ทอง (Legend)">🟠ทอง</button>
                                        </div>
                                    </div>

                                    <!-- 🪵 วัตถุดิบ -->
                                    <div class="eni-dep-cg-row" data-cat="material" style="display:flex; align-items:center; justify-content:space-between; padding:1px 0;">
                                        <span style="font-size:10px; color:#c8e6c9; font-weight:bold; min-width:62px;">🪵 วัตถุดิบ</span>
                                        <div style="display:flex; gap:3px;">
                                            <button type="button" class="eni-dep-cg-pill" data-cat="material" data-grade="common" style="padding:2px 4px; font-size:9px; border-radius:4px; cursor:pointer; border:1px solid #444;" title="ขาว (Common)">⚪ขาว</button>
                                            <button type="button" class="eni-dep-cg-pill" data-cat="material" data-grade="fine" style="padding:2px 4px; font-size:9px; border-radius:4px; cursor:pointer; border:1px solid #444;" title="เขียว (Fine)">🟢เขียว</button>
                                            <button type="button" class="eni-dep-cg-pill" data-cat="material" data-grade="rare" style="padding:2px 4px; font-size:9px; border-radius:4px; cursor:pointer; border:1px solid #444;" title="ฟ้า (Rare)">🔵ฟ้า</button>
                                            <button type="button" class="eni-dep-cg-pill" data-cat="material" data-grade="epic" style="padding:2px 4px; font-size:9px; border-radius:4px; cursor:pointer; border:1px solid #444;" title="ม่วง (Epic)">🟣ม่วง</button>
                                            <button type="button" class="eni-dep-cg-pill" data-cat="material" data-grade="legend" style="padding:2px 4px; font-size:9px; border-radius:4px; cursor:pointer; border:1px solid #444;" title="ทอง (Legend)">🟠ทอง</button>
                                        </div>
                                    </div>

                                    <!-- 🧪 ของใช้ -->
                                    <div class="eni-dep-cg-row" data-cat="consumable" style="display:flex; align-items:center; justify-content:space-between; padding:1px 0;">
                                        <span style="font-size:10px; color:#c8e6c9; font-weight:bold; min-width:62px;">🧪 ของใช้</span>
                                        <div style="display:flex; gap:3px;">
                                            <button type="button" class="eni-dep-cg-pill" data-cat="consumable" data-grade="common" style="padding:2px 4px; font-size:9px; border-radius:4px; cursor:pointer; border:1px solid #444;" title="ขาว (Common)">⚪ขาว</button>
                                            <button type="button" class="eni-dep-cg-pill" data-cat="consumable" data-grade="fine" style="padding:2px 4px; font-size:9px; border-radius:4px; cursor:pointer; border:1px solid #444;" title="เขียว (Fine)">🟢เขียว</button>
                                            <button type="button" class="eni-dep-cg-pill" data-cat="consumable" data-grade="rare" style="padding:2px 4px; font-size:9px; border-radius:4px; cursor:pointer; border:1px solid #444;" title="ฟ้า (Rare)">🔵ฟ้า</button>
                                            <button type="button" class="eni-dep-cg-pill" data-cat="consumable" data-grade="epic" style="padding:2px 4px; font-size:9px; border-radius:4px; cursor:pointer; border:1px solid #444;" title="ม่วง (Epic)">🟣ม่วง</button>
                                            <button type="button" class="eni-dep-cg-pill" data-cat="consumable" data-grade="legend" style="padding:2px 4px; font-size:9px; border-radius:4px; cursor:pointer; border:1px solid #444;" title="ทอง (Legend)">🟠ทอง</button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- ตัวเลือกเสริม: เดินกลับที่เดิม & เปิดออโต้ตี -->
                            <div style="margin-top:6px; display:flex; flex-direction:column; gap:4px; font-size:10px; color:#bbb;">
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <label style="display:flex; align-items:center; gap:4px; cursor:pointer;">
                                        <input type="checkbox" id="eni-auto-return-check" checked style="accent-color:#ff66b2; cursor:pointer;">
                                        เสร็จแล้วเดินกลับจุดเดิมออโต้
                                    </label>
                                    <span style="color:#777; font-size:9.5px;">(🔒ผูกมัด/🏷️เควสต์ ปลอดภัย)</span>
                                </div>
                                <label style="display:flex; align-items:center; gap:4px; cursor:pointer; color:#ffb3d9;">
                                    <input type="checkbox" id="eni-auto-attack-check" checked style="accent-color:#ff66b2; cursor:pointer;">
                                    ⚔️ ถึงจุดเดิมแล้วเปิด "ออโต้ตี" ทันที
                                </label>
                                <label style="display:flex; align-items:center; gap:4px; cursor:pointer; color:#ff9999;">
                                    <input type="checkbox" id="eni-auto-destroy-quest-check" style="accent-color:#d32f2f; cursor:pointer;">
                                    🗑️ ทิ้งของเควสต์ออโต้เมื่อไปขาย/ฝาก
                                </label>
                            </div>
                        </div>

                        <!-- แถวปุ่มเดินด้วยตนเอง และระบบต่อสู้ (Manual Navigation & Combat Controls) -->
                        <div style="display:flex; gap:4px; margin-top:8px;">
                            <button id="eni-walk-shop-btn" style="flex:1; padding:6px 2px; cursor:pointer; background:#2a85ff; color:#fff; border:none; border-radius:6px; font-weight:bold; font-size: 10px; transition: 0.2s;" title="เดินไปร้านค้า">
                                🚶 ไปร้านค้า
                            </button>
                            <button id="eni-walk-storage-btn" style="flex:1; padding:6px 2px; cursor:pointer; background:#9c27b0; color:#fff; border:none; border-radius:6px; font-weight:bold; font-size: 10px; transition: 0.2s;" title="เดินไปคลังเก็บของ">
                                📦 ไปคลัง
                            </button>
                            <button id="eni-walk-back-btn" style="flex:1; padding:6px 2px; cursor:pointer; background:#00bb66; color:#fff; border:none; border-radius:6px; font-weight:bold; font-size: 10px; transition: 0.2s;" title="เดินกลับไปยังจุดฟาร์มเดิม">
                                🔙 กลับที่เดิม
                            </button>
                            <button id="eni-auto-hunt-btn" style="flex:1; padding:6px 2px; cursor:pointer; background:#2a2a2e; color:#ccc; border:1px solid #555; border-radius:6px; font-weight:bold; font-size: 10px; transition: 0.2s;" title="คลิกเพื่อ เปิด/ปิด ระบบออโต้ตีทันที">
                                ⚔️ ออโต้: ปิด
                            </button>
                        </div>
                    </div>
                </div>
                <!-- มุมขวาล่างสำหรับลากปรับขยายขนาด (Resize Handle) -->
                <div id="eni-resizer" style="position:absolute; right:3px; bottom:2px; width:16px; height:16px; cursor:nwse-resize; color:#ff66b2aa; font-size:11px; text-align:right; line-height:16px; user-select:none;" title="คลิกลากเพื่อปรับขนาดหน้าต่าง">◢</div>
            </div>
        `;
        document.body.appendChild(overlay);

        const panel = document.getElementById('eni-panel');
        const header = document.getElementById('eni-header');
        const resizer = document.getElementById('eni-resizer');
        const invBox = document.getElementById('eni-inventory-ui');
        const btn = document.getElementById('eni-toggle-graphics');
        const statusText = document.getElementById('eni-gpu-status');
        const panelContent = document.getElementById('eni-content');
        const minimizeBtn = document.getElementById('eni-minimize');
        let isMinimized = false;

        // คืนค่าตำแหน่งและขนาดที่บันทึกไว้ใน LocalStorage
        try {
            const savedPos = JSON.parse(localStorage.getItem('eni_panel_pos') || 'null');
            if (savedPos && typeof savedPos.top === 'number' && typeof savedPos.left === 'number') {
                const maxL = Math.max(0, window.innerWidth - 80);
                const maxT = Math.max(0, window.innerHeight - 80);
                panel.style.top = `${Math.min(Math.max(5, savedPos.top), maxT)}px`;
                panel.style.left = `${Math.min(Math.max(5, savedPos.left), maxL)}px`;
            }
            const savedSize = JSON.parse(localStorage.getItem('eni_panel_size') || 'null');
            if (savedSize) {
                if (savedSize.width) panel.style.width = `${Math.min(Math.max(270, savedSize.width), window.innerWidth - 20)}px`;
                if (savedSize.invHeight && invBox) {
                    invBox.style.maxHeight = `${savedSize.invHeight}px`;
                }
            }
        } catch (e) {}

        // 1. ระบบลากย้ายตำแหน่ง UI (Draggable via Header)
        let isDragging = false;
        let dragStartX = 0, dragStartY = 0;
        let panelStartX = 0, panelStartY = 0;

        header.addEventListener('pointerdown', (e) => {
            if (e.target.id === 'eni-minimize' || e.target.closest('#eni-minimize')) return;
            isDragging = true;
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            const rect = panel.getBoundingClientRect();
            panelStartX = rect.left;
            panelStartY = rect.top;
            try { header.setPointerCapture(e.pointerId); } catch (err) {}
            panel.style.transition = 'none';
            e.preventDefault();
        });

        header.addEventListener('pointermove', (e) => {
            if (!isDragging) return;
            const dx = e.clientX - dragStartX;
            const dy = e.clientY - dragStartY;
            const newLeft = Math.max(5, Math.min(window.innerWidth - panel.offsetWidth - 5, panelStartX + dx));
            const newTop = Math.max(5, Math.min(window.innerHeight - panel.offsetHeight - 5, panelStartY + dy));
            panel.style.left = `${newLeft}px`;
            panel.style.top = `${newTop}px`;
        });

        const stopDrag = (e) => {
            if (isDragging) {
                isDragging = false;
                try { header.releasePointerCapture(e.pointerId); } catch (err) {}
                panel.style.transition = 'box-shadow 0.2s';
                const rect = panel.getBoundingClientRect();
                try {
                    localStorage.setItem('eni_panel_pos', JSON.stringify({ top: Math.round(rect.top), left: Math.round(rect.left) }));
                } catch (err) {}
            }
        };
        header.addEventListener('pointerup', stopDrag);
        header.addEventListener('pointercancel', stopDrag);

        // 2. ระบบปรับย่อ/ขยายขนาด UI (Resizable via Corner Handle)
        let isResizing = false;
        let resizeStartX = 0, resizeStartY = 0;
        let panelStartW = 0, invStartH = 0;

        if (resizer) {
            resizer.addEventListener('pointerdown', (e) => {
                isResizing = true;
                resizeStartX = e.clientX;
                resizeStartY = e.clientY;
                panelStartW = panel.offsetWidth;
                invStartH = invBox ? invBox.offsetHeight : 180;
                try { resizer.setPointerCapture(e.pointerId); } catch (err) {}
                panel.style.transition = 'none';
                e.preventDefault();
                e.stopPropagation();
            });

            resizer.addEventListener('pointermove', (e) => {
                if (!isResizing) return;
                const dx = e.clientX - resizeStartX;
                const dy = e.clientY - resizeStartY;
                const newW = Math.max(270, Math.min(window.innerWidth - panel.offsetLeft - 10, panelStartW + dx));
                panel.style.width = `${newW}px`;
                if (invBox) {
                    const newH = Math.max(100, Math.min(window.innerHeight - 350, invStartH + dy));
                    invBox.style.maxHeight = `${newH}px`;
                }
            });

            const stopResize = (e) => {
                if (isResizing) {
                    isResizing = false;
                    try { resizer.releasePointerCapture(e.pointerId); } catch (err) {}
                    panel.style.transition = 'box-shadow 0.2s';
                    try {
                        localStorage.setItem('eni_panel_size', JSON.stringify({
                            width: Math.round(panel.offsetWidth),
                            invHeight: invBox ? Math.round(invBox.offsetHeight) : 180
                        }));
                    } catch (err) {}
                }
            };
            resizer.addEventListener('pointerup', stopResize);
            resizer.addEventListener('pointercancel', stopResize);
        }

        minimizeBtn.addEventListener('click', () => {
            isMinimized = !isMinimized;
            panelContent.style.display = isMinimized ? 'none' : 'block';
            if (resizer) resizer.style.display = isMinimized ? 'none' : 'block';
            minimizeBtn.innerText = isMinimized ? '[ ➕ ]' : '[ ➖ ]';
            if (isMinimized) {
                panel.style.width = 'auto';
            } else {
                try {
                    const savedSize = JSON.parse(localStorage.getItem('eni_panel_size') || 'null');
                    panel.style.width = `${savedSize?.width || 320}px`;
                } catch (e) {
                    panel.style.width = '320px';
                }
            }
        });

        function updateUI() {
            if (graphicsEnabled) {
                btn.style.background = '#ff3333';
                btn.innerText = 'ปิดภาพ 3D (Disable 3D)';
                statusText.innerHTML = '🔥 3D Engine: <b style="color:#ff3333;">ENABLED (Consuming GPU)</b>';
                whiteScreen.style.opacity = "0";
                setTimeout(() => whiteScreen.style.display = "none", 300);
            } else {
                btn.style.background = '#ff66b2';
                btn.innerText = 'เปิดภาพ 3D กลับมา (Toggle 3D)';
                statusText.innerHTML = '📉 3D Engine: <b>DISABLED (0% GPU)</b>';
                whiteScreen.style.display = "flex";
                setTimeout(() => whiteScreen.style.opacity = "1", 10);
            }
        }

        const toggleGraphics = () => {
            graphicsEnabled = !graphicsEnabled;
            updateUI();
        };

        btn.addEventListener('click', toggleGraphics);
        
        // เพิ่มเข้าไปในเมนูของ Tampermonkey
        if (typeof GM_registerMenuCommand !== 'undefined') {
            GM_registerMenuCommand("Toggle 3D Graphics / White Screen", toggleGraphics);
        }
        
        // ซ่อน Canvas จริงๆ ไปด้วยเพื่อความชัวร์ (ถ้าปิดภาพอยู่)
        setInterval(() => {
            const canvas = document.querySelector('canvas');
            if (canvas) {
                canvas.style.opacity = graphicsEnabled ? "1" : "0.01";
            }
        }, 1000);

        // ดัก Event ขายไอเทมจากปุ่มในกระเป๋า (Event Delegation)
        const invContainer = document.getElementById('eni-inventory-ui');
        if (invContainer) {
            invContainer.addEventListener('click', async (e) => {
                const sellBtn = e.target.closest('.eni-sell-btn');
                if (sellBtn) {
                    const id = Number(sellBtn.getAttribute('data-sell-id'));
                    if (id !== undefined && !isNaN(id)) {
                        sellBtn.disabled = true;
                        sellBtn.innerText = '...';
                        await doSellItem(id);
                        sellBtn.disabled = false;
                        sellBtn.innerText = 'ขาย';
                    }
                }

                const depItemBtn = e.target.closest('.eni-deposit-btn');
                if (depItemBtn) {
                    const id = Number(depItemBtn.getAttribute('data-deposit-id'));
                    if (id !== undefined && !isNaN(id)) {
                        depItemBtn.disabled = true;
                        depItemBtn.innerText = '...';
                        await doDepositItem(id);
                        depItemBtn.disabled = false;
                        depItemBtn.innerText = 'ฝาก';
                    }
                }

                // ปุ่มสวมใส่อุปกรณ์ทันที (⚔️ ใส่)
                const equipBtn = e.target.closest('.eni-equip-btn');
                if (equipBtn) {
                    const id = Number(equipBtn.getAttribute('data-equip-id'));
                    if (id !== undefined && !isNaN(id)) {
                        equipBtn.disabled = true;
                        equipBtn.innerText = '⏳ ใส่...';
                        await doEquipItem(id);
                    }
                }

                // ปุ่มทิ้งไอเทมเควสต์เดี่ยว (🗑️ ทิ้ง พร้อมระบบยืนยัน 2 สเต็ป)
                const destroyBtn = e.target.closest('.eni-destroy-btn');
                if (destroyBtn) {
                    const id = Number(destroyBtn.getAttribute('data-destroy-id'));
                    const name = destroyBtn.getAttribute('data-item-name') || 'ไอเทมเควสต์';
                    if (id !== undefined && !isNaN(id)) {
                        if (!destroyBtn.getAttribute('data-confirming')) {
                            destroyBtn.setAttribute('data-confirming', 'true');
                            const oldText = destroyBtn.innerHTML;
                            destroyBtn.innerHTML = '⚠️ ยืนยัน?';
                            destroyBtn.style.background = '#ff9800';
                            destroyBtn.style.borderColor = '#ffa726';
                            const resetTimeout = setTimeout(() => {
                                destroyBtn.removeAttribute('data-confirming');
                                destroyBtn.innerHTML = oldText;
                                destroyBtn.style.background = '#c62828';
                                destroyBtn.style.borderColor = '#ef5350';
                            }, 3000);
                            destroyBtn._resetTimeout = resetTimeout;
                        } else {
                            if (destroyBtn._resetTimeout) clearTimeout(destroyBtn._resetTimeout);
                            destroyBtn.removeAttribute('data-confirming');
                            destroyBtn.disabled = true;
                            destroyBtn.innerHTML = '⏳ กำลังทิ้ง...';
                            await doDestroyItem(id, name);
                        }
                    }
                }

                // ปุ่มทิ้งของเควสต์ทั้งหมด (🗑️ ทิ้งทั้งหมด)
                const destroyAllBtn = e.target.closest('#eni-destroy-all-quest-btn');
                if (destroyAllBtn) {
                    if (!destroyAllBtn.getAttribute('data-confirming')) {
                        destroyAllBtn.setAttribute('data-confirming', 'true');
                        const oldText = destroyAllBtn.innerHTML;
                        destroyAllBtn.innerHTML = '⚠️ แน่ใจนะ? (กดซ้ำ)';
                        destroyAllBtn.style.background = '#e65100';
                        destroyAllBtn.style.borderColor = '#ff9800';
                        const resetTimeout = setTimeout(() => {
                            destroyAllBtn.removeAttribute('data-confirming');
                            destroyAllBtn.innerHTML = oldText;
                            destroyAllBtn.style.background = '#b71c1c';
                            destroyAllBtn.style.borderColor = '#ef5350';
                        }, 3500);
                        destroyAllBtn._resetTimeout = resetTimeout;
                    } else {
                        if (destroyAllBtn._resetTimeout) clearTimeout(destroyAllBtn._resetTimeout);
                        destroyAllBtn.removeAttribute('data-confirming');
                        destroyAllBtn.disabled = true;
                        destroyAllBtn.innerHTML = '⏳ กำลังทิ้งทั้งหมด...';
                        await doDestroyAllQuestItems();
                    }
                }
            });
        }

        // ปุ่มจำจุดนี้ (📌 จำจุดนี้)
        const saveSpotBtn = document.getElementById('eni-save-spot-btn');
        if (saveSpotBtn) {
            saveSpotBtn.addEventListener('click', () => {
                const spot = recordOriginSpot(true);
                if (spot) {
                    saveSpotBtn.innerText = '✅ จำแล้ว';
                    setTimeout(() => { saveSpotBtn.innerText = '📌 จำจุดนี้'; }, 1500);
                }
            });
        }

        // ปุ่มกดเดินไปร้านค้า (🏪 ไปร้านค้า)
        const walkShopBtn = document.getElementById('eni-walk-shop-btn');
        if (walkShopBtn) {
            walkShopBtn.addEventListener('click', async () => {
                walkShopBtn.disabled = true;
                const oldText = walkShopBtn.innerText;
                walkShopBtn.innerText = '⏳ กำลังไป...';
                await walkToShopNpc();
                walkShopBtn.innerText = oldText;
                walkShopBtn.disabled = false;
            });
        }

        // ปุ่มกดเดินกลับจุดฟาร์มเดิม (🔙 กลับที่เดิม)
        const walkBackBtn = document.getElementById('eni-walk-back-btn');
        if (walkBackBtn) {
            walkBackBtn.addEventListener('click', async () => {
                walkBackBtn.disabled = true;
                const oldText = walkBackBtn.innerText;
                walkBackBtn.innerText = '⏳ กำลังกลับ...';
                await walkBackToOrigin();
                if (AUTO_SELL_CONFIG.autoAttackOnReturn) {
                    await waitForArrivalAtOrigin(originSpot, 50000);
                    await new Promise(r => setTimeout(r, 600));
                    enableAutoHunt();
                }
                walkBackBtn.innerText = oldText;
                walkBackBtn.disabled = false;
            });
        }

        // ปุ่มกดเปิด/ปิด ออโต้ตี โดยตรง (⚔️ ออโต้ตี)
        const autoHuntBtn = document.getElementById('eni-auto-hunt-btn');
        if (autoHuntBtn) {
            autoHuntBtn.addEventListener('click', () => {
                toggleAutoHunt();
            });
        }

        // ปุ่ม Start Loop (เปิด/ปิด ออโต้ลูปขายของเมื่อกระเป๋าเต็ม)
        const autoSellLoopBtn = document.getElementById('eni-auto-sell-loop-btn');
        if (autoSellLoopBtn) {
            autoSellLoopBtn.addEventListener('click', () => {
                toggleAutoSellLoop();
            });
        }

        // ปุ่มไปขายทันที / ยกเลิกการขาย (🔥 ไปขายทันที / 🛑 ยกเลิก)
        const sellNowBtn = document.getElementById('eni-sell-now-btn');
        if (sellNowBtn) {
            sellNowBtn.addEventListener('click', async () => {
                if (isSellingRoutineRunning) {
                    cancelSellTrip();
                } else {
                    await executeSellTrip(true);
                }
            });
        }

        // ปุ่มไปฝากทันที / ยกเลิกการฝาก (📦 ไปฝากทันที / 🛑 ยกเลิก)
        const depNowBtn = document.getElementById('eni-deposit-now-btn');
        if (depNowBtn) {
            depNowBtn.addEventListener('click', async () => {
                if (isSellingRoutineRunning) {
                    cancelSellTrip();
                } else {
                    await executeDepositTrip(true);
                }
            });
        }

        // ปุ่มเดินไปคลังเก็บของ (📦 ไปคลัง)
        const walkStorageBtn = document.getElementById('eni-walk-storage-btn');
        if (walkStorageBtn) {
            walkStorageBtn.addEventListener('click', async () => {
                walkStorageBtn.disabled = true;
                const oldText = walkStorageBtn.innerText;
                walkStorageBtn.innerText = '⏳ กำลังไป...';
                await walkToStorageNpc();
                walkStorageBtn.innerText = oldText;
                walkStorageBtn.disabled = false;
            });
        }

        // Checkboxes การฝากของเข้าคลัง (Storage / Warehouse Settings)
        const autoDepSellCheck = document.getElementById('eni-auto-deposit-sell-check');
        if (autoDepSellCheck) {
            autoDepSellCheck.checked = AUTO_SELL_CONFIG.depositDuringSell;
            autoDepSellCheck.addEventListener('change', (e) => {
                AUTO_SELL_CONFIG.depositDuringSell = e.target.checked;
                saveAutoSellConfig();
                updateBagCapacityUI();
                console.log(`💖 ENI: ตั้งค่าแวะฝากคลังตอนไปขายของ: ${AUTO_SELL_CONFIG.depositDuringSell ? 'เปิด ✅' : 'ปิด ❌'}`);
            });
        }



        // กำหนดสีและสไตล์ของเกรดเมื่อเปิดใช้งาน (Active Grade Pill Themes)
        const gradeColorMap = {
            common: { bg: 'rgba(207, 200, 180, 0.22)', border: '#cfc8b4', text: '#f5f0e1', glow: 'rgba(207, 200, 180, 0.35)' },
            fine:   { bg: 'rgba(111, 214, 111, 0.22)', border: '#6fd66f', text: '#99ff99', glow: 'rgba(111, 214, 111, 0.35)' },
            rare:   { bg: 'rgba(90, 168, 255, 0.25)',  border: '#5aa8ff', text: '#8ec5ff', glow: 'rgba(90, 168, 255, 0.4)' },
            epic:   { bg: 'rgba(184, 123, 255, 0.25)', border: '#b87bff', text: '#dfb8ff', glow: 'rgba(184, 123, 255, 0.4)' },
            legend: { bg: 'rgba(255, 166, 48, 0.25)',  border: '#ffa630', text: '#ffd680', glow: 'rgba(255, 166, 48, 0.4)' }
        };

        function renderCategoryGradePills() {
            document.querySelectorAll('.eni-cg-pill').forEach(pill => {
                const cat = pill.getAttribute('data-cat');
                const grade = pill.getAttribute('data-grade');
                const allowedList = AUTO_SELL_CONFIG.categoryGrades?.[cat] || [];
                const isActive = allowedList.includes(grade);
                const col = gradeColorMap[grade] || { bg: '#333', border: '#666', text: '#fff', glow: 'transparent' };

                if (isActive) {
                    pill.style.background = col.bg;
                    pill.style.borderColor = col.border;
                    pill.style.color = col.text;
                    pill.style.boxShadow = `0 0 5px ${col.glow}`;
                    pill.style.opacity = '1';
                    pill.style.filter = 'none';
                    pill.style.fontWeight = 'bold';
                } else {
                    pill.style.background = 'rgba(255, 255, 255, 0.03)';
                    pill.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                    pill.style.color = '#555';
                    pill.style.boxShadow = 'none';
                    pill.style.opacity = '0.45';
                    pill.style.filter = 'grayscale(1)';
                    pill.style.fontWeight = 'normal';
                }
            });
        }

        function renderDepositCategoryGradePills() {
            document.querySelectorAll('.eni-dep-cg-pill').forEach(pill => {
                const cat = pill.getAttribute('data-cat');
                const grade = pill.getAttribute('data-grade');
                const allowedList = AUTO_SELL_CONFIG.depositCategoryGrades?.[cat] || [];
                const isActive = allowedList.includes(grade);
                const col = gradeColorMap[grade] || { bg: '#333', border: '#666', text: '#fff', glow: 'transparent' };

                if (isActive) {
                    pill.style.background = col.bg;
                    pill.style.borderColor = col.border;
                    pill.style.color = col.text;
                    pill.style.boxShadow = `0 0 5px ${col.glow}`;
                    pill.style.opacity = '1';
                    pill.style.filter = 'none';
                    pill.style.fontWeight = 'bold';
                } else {
                    pill.style.background = 'rgba(255, 255, 255, 0.03)';
                    pill.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                    pill.style.color = '#555';
                    pill.style.boxShadow = 'none';
                    pill.style.opacity = '0.45';
                    pill.style.filter = 'grayscale(1)';
                    pill.style.fontWeight = 'normal';
                }
            });
        }

        // จัดการคลิกเลือก/ยกเลิก เกรดสำหรับขาย (Click to Toggle Sell Grade per Category)
        const catGradeMatrix = document.getElementById('eni-cat-grade-matrix');
        if (catGradeMatrix) {
            catGradeMatrix.addEventListener('click', (e) => {
                const pill = e.target.closest('.eni-cg-pill');
                if (!pill) return;
                const cat = pill.getAttribute('data-cat');
                const grade = pill.getAttribute('data-grade');
                if (!cat || !grade) return;

                if (!AUTO_SELL_CONFIG.categoryGrades[cat]) {
                    AUTO_SELL_CONFIG.categoryGrades[cat] = [];
                }

                const list = AUTO_SELL_CONFIG.categoryGrades[cat];
                const idx = list.indexOf(grade);
                if (idx >= 0) {
                    list.splice(idx, 1);
                } else {
                    list.push(grade);
                }

                saveAutoSellConfig();
                renderCategoryGradePills();
                updateBagCapacityUI();
                console.log(`💖 ENI: อัปเดตเกรดขายหมวด [${cat}]:`, AUTO_SELL_CONFIG.categoryGrades[cat]);
            });
        }

        // จัดการคลิกเลือก/ยกเลิก เกรดสำหรับฝากคลัง (Click to Toggle Deposit Grade per Category)
        const depCatGradeMatrix = document.getElementById('eni-dep-cat-grade-matrix');
        if (depCatGradeMatrix) {
            depCatGradeMatrix.addEventListener('click', (e) => {
                const pill = e.target.closest('.eni-dep-cg-pill');
                if (!pill) return;
                const cat = pill.getAttribute('data-cat');
                const grade = pill.getAttribute('data-grade');
                if (!cat || !grade) return;

                if (!AUTO_SELL_CONFIG.depositCategoryGrades) {
                    AUTO_SELL_CONFIG.depositCategoryGrades = {};
                }
                if (!AUTO_SELL_CONFIG.depositCategoryGrades[cat]) {
                    AUTO_SELL_CONFIG.depositCategoryGrades[cat] = [];
                }

                const list = AUTO_SELL_CONFIG.depositCategoryGrades[cat];
                const idx = list.indexOf(grade);
                if (idx >= 0) {
                    list.splice(idx, 1);
                } else {
                    list.push(grade);
                }

                saveAutoSellConfig();
                renderDepositCategoryGradePills();
                updateBagCapacityUI();
                console.log(`💖 ENI: อัปเดตเกรดฝากคลังหมวด [${cat}]:`, AUTO_SELL_CONFIG.depositCategoryGrades[cat]);
            });
        }

        // Checkbox ขายเสร็จแล้วเดินกลับที่เดิมออโต้
        const autoReturnCheck = document.getElementById('eni-auto-return-check');
        if (autoReturnCheck) {
            autoReturnCheck.checked = AUTO_SELL_CONFIG.autoReturn;
            autoReturnCheck.addEventListener('change', (e) => {
                AUTO_SELL_CONFIG.autoReturn = e.target.checked;
                saveAutoSellConfig();
                console.log(`💖 ENI: ตั้งค่าเดินกลับจุดเดิมอัตโนมัติ: ${AUTO_SELL_CONFIG.autoReturn ? 'เปิด ✅' : 'ปิด ❌'}`);
            });
        }

        // Checkbox ถึงจุดเดิมแล้วเปิดออโต้ตี
        const autoAttackCheck = document.getElementById('eni-auto-attack-check');
        if (autoAttackCheck) {
            autoAttackCheck.checked = AUTO_SELL_CONFIG.autoAttackOnReturn;
            autoAttackCheck.addEventListener('change', (e) => {
                AUTO_SELL_CONFIG.autoAttackOnReturn = e.target.checked;
                saveAutoSellConfig();
                console.log(`💖 ENI: ตั้งค่าเปิดออโต้ตีเมื่อกลับถึงจุดเดิม: ${AUTO_SELL_CONFIG.autoAttackOnReturn ? 'เปิด ✅' : 'ปิด ❌'}`);
            });
        }

        const autoDestroyQuestCheck = document.getElementById('eni-auto-destroy-quest-check');
        if (autoDestroyQuestCheck) {
            autoDestroyQuestCheck.checked = AUTO_SELL_CONFIG.autoDestroyQuest;
            autoDestroyQuestCheck.addEventListener('change', (e) => {
                AUTO_SELL_CONFIG.autoDestroyQuest = e.target.checked;
                saveAutoSellConfig();
                console.log(`💖 ENI: ตั้งค่าทิ้งของเควสต์อัตโนมัติ: ${AUTO_SELL_CONFIG.autoDestroyQuest ? 'เปิด ✅' : 'ปิด ❌'}`);
            });
        }

        // Radio เลือกวิธีเดินทางไปร้านค้า (ใช้คัมภีร์กลับเมือง vs เดินปกติ)
        const travelScrollRadio = document.getElementById('eni-travel-scroll-radio');
        const travelWalkRadio = document.getElementById('eni-travel-walk-radio');
        if (travelScrollRadio && travelWalkRadio) {
            if (AUTO_SELL_CONFIG.travelMethod === 'walk') {
                travelWalkRadio.checked = true;
            } else {
                travelScrollRadio.checked = true;
            }
            travelScrollRadio.addEventListener('change', (e) => {
                if (e.target.checked) {
                    AUTO_SELL_CONFIG.travelMethod = 'scroll';
                    saveAutoSellConfig();
                    console.log("💖 ENI: ตั้งค่าวิธีเดินทางไปร้านค้า: 📜 ใช้คัมภีร์กลับเมือง");
                }
            });
            travelWalkRadio.addEventListener('change', (e) => {
                if (e.target.checked) {
                    AUTO_SELL_CONFIG.travelMethod = 'walk';
                    saveAutoSellConfig();
                    console.log("💖 ENI: ตั้งค่าวิธีเดินทางไปร้านค้า: 🚶 เดินปกติ");
                }
            });
        }



        renderCategoryGradePills();
        renderDepositCategoryGradePills();
        updateLoopStatusUI();
        updateBagCapacityUI();
        updateReturnScrollUI();

        // จัดการคลิกเปลี่ยนแท็บหมวดหมู่ (Category Tab Switching)
        let currentTab = 'all';
        let currentGrade = 'all';

        const tabsContainer = document.getElementById('eni-category-tabs');
        if (tabsContainer) {
            tabsContainer.addEventListener('click', (e) => {
                const btn = e.target.closest('.eni-tab-btn');
                if (btn) {
                    currentTab = btn.getAttribute('data-tab') || 'all';
                    tabsContainer.querySelectorAll('.eni-tab-btn').forEach(b => {
                        const isActive = b === btn;
                        b.style.background = isActive ? '#ff66b2' : '#222';
                        b.style.color = isActive ? '#fff' : '#aaa';
                        b.style.borderColor = isActive ? '#ff66b2' : '#444';
                    });
                    const invBox = document.getElementById('eni-inventory-ui');
                    if (invBox) invBox.removeAttribute('data-hash'); // สั่งให้วาดใหม่ทันที
                }
            });
        }

        // จัดการคลิกเปลี่ยนตัวกรองระดับเกรด (Grade Filter Switching)
        const gradeContainer = document.getElementById('eni-grade-filter');
        if (gradeContainer) {
            gradeContainer.addEventListener('click', (e) => {
                const btn = e.target.closest('.eni-grade-btn');
                if (btn) {
                    currentGrade = btn.getAttribute('data-grade') || 'all';
                    gradeContainer.querySelectorAll('.eni-grade-btn').forEach(b => {
                        const isActive = b === btn;
                        const g = b.getAttribute('data-grade');
                        const gColor = GRADE_COLORS[g] || '#ff66b2';
                        if (isActive) {
                            b.style.background = g === 'all' ? '#ff66b2' : `${gColor}2e`;
                            b.style.color = g === 'all' ? '#fff' : gColor;
                            b.style.borderColor = g === 'all' ? '#ff66b2' : gColor;
                            b.style.boxShadow = `0 0 6px ${gColor}55`;
                        } else {
                            b.style.background = '#1c1c1c';
                            b.style.color = g === 'all' ? '#aaa' : gColor;
                            b.style.borderColor = '#444';
                            b.style.boxShadow = 'none';
                        }
                    });
                    const invBox = document.getElementById('eni-inventory-ui');
                    if (invBox) invBox.removeAttribute('data-hash'); // สั่งให้วาดใหม่ทันที
                }
            });
        }

        updateOriginSpotUI();
        updateAutoHuntButtonUI();
        
        // อัปเดต UI กระเป๋าและปุ่มควบคุมแบบเรียลไทม์
        setInterval(() => {
            updateBagCapacityUI();
            updateAutoHuntButtonUI();
            updateReturnScrollUI();
            const invBox = document.getElementById('eni-inventory-ui');
            const countLabel = document.getElementById('eni-bag-count');
            if (invBox && countLabel && !isMinimized) {
                const liveItems = getLiveInventory();
                
                // ตรวจสอบความเปลี่ยนแปลงก่อนทำงาน (Fast Hash Check)
                // ถ้าไอเทมในกระเป๋าเท่าเดิม แท็บเดิม และเกรดเดิม ไม่ต้องคำนวณ DOM ใหม่ ประหยัด CPU 100%!
                const liveHash = `${currentTab}:${currentGrade}:${liveItems.length}:${liveItems.map(i => `${i.id}:${i.q}:${i.grade}`).join(',')}`;
                if (invBox.getAttribute('data-hash') === liveHash) {
                    return;
                }
                invBox.setAttribute('data-hash', liveHash);

                countLabel.innerText = liveItems.length;

                // 1. อัปเดตตัวเลขแสดงจำนวนบน Tab หมวดหมู่แบบเรียลไทม์ (รวมเควสต์)
                const cntAll = document.getElementById('eni-cnt-all');
                const cntEquip = document.getElementById('eni-cnt-equip');
                const cntMaterial = document.getElementById('eni-cnt-material');
                const cntConsumable = document.getElementById('eni-cnt-consumable');
                const cntQuest = document.getElementById('eni-cnt-quest');

                if (cntAll) cntAll.innerText = liveItems.length;
                if (cntEquip) cntEquip.innerText = liveItems.filter(i => i.category === 'equip').length;
                if (cntMaterial) cntMaterial.innerText = liveItems.filter(i => i.category === 'material').length;
                if (cntConsumable) cntConsumable.innerText = liveItems.filter(i => i.category === 'consumable').length;
                if (cntQuest) cntQuest.innerText = liveItems.filter(i => i.category === 'quest').length;

                // 2. อัปเดตตัวเลขแสดงจำนวนบน Grade Filter แบบเรียลไทม์
                const gcntAll = document.getElementById('eni-gcnt-all');
                const gcntCommon = document.getElementById('eni-gcnt-common');
                const gcntFine = document.getElementById('eni-gcnt-fine');
                const gcntRare = document.getElementById('eni-gcnt-rare');
                const gcntEpic = document.getElementById('eni-gcnt-epic');
                const gcntLegend = document.getElementById('eni-gcnt-legend');
                const gcntMythic = document.getElementById('eni-gcnt-mythic');

                if (gcntAll) gcntAll.innerText = liveItems.length;
                if (gcntCommon) gcntCommon.innerText = liveItems.filter(i => (i.grade || 'common') === 'common').length;
                if (gcntFine) gcntFine.innerText = liveItems.filter(i => (i.grade || 'common') === 'fine').length;
                if (gcntRare) gcntRare.innerText = liveItems.filter(i => (i.grade || 'common') === 'rare').length;
                if (gcntEpic) gcntEpic.innerText = liveItems.filter(i => (i.grade || 'common') === 'epic').length;
                if (gcntLegend) gcntLegend.innerText = liveItems.filter(i => (i.grade || 'common') === 'legend').length;
                if (gcntMythic) gcntMythic.innerText = liveItems.filter(i => (i.grade || 'common') === 'mythic').length;

                // 3. กรองไอเทมตาม Tab หมวดหมู่ และ ระดับเกรด
                let displayItems = liveItems;
                if (currentTab === 'equip') displayItems = displayItems.filter(i => i.category === 'equip');
                else if (currentTab === 'material') displayItems = displayItems.filter(i => i.category === 'material');
                else if (currentTab === 'consumable') displayItems = displayItems.filter(i => i.category === 'consumable');
                else if (currentTab === 'quest') displayItems = displayItems.filter(i => i.category === 'quest');

                if (currentGrade !== 'all') {
                    displayItems = displayItems.filter(i => (i.grade || 'common') === currentGrade);
                }

                if (displayItems.length === 0) {
                    const filterParts = [];
                    if (currentTab !== 'all') filterParts.push(CATEGORY_NAMES[currentTab] || currentTab);
                    if (currentGrade !== 'all') filterParts.push(GRADE_NAMES[currentGrade] || currentGrade);
                    const detail = filterParts.length > 0 ? ` (${filterParts.join(' / ')})` : '';
                    const emptyMsg = liveItems.length === 0 ? 'กระเป๋าว่างเปล่า' : `ไม่มีไอเทมตามเงื่อนไข${detail}`;
                    invBox.innerHTML = `<div style="color:#aaa; text-align:center; font-size:12px; padding: 15px 0;">${emptyMsg}</div>`;
                } else {
                    let html = '';

                    // ถ้าอยู่หน้าแท็บเควสต์ และมีของเควสต์ ให้แสดงแถบปุ่มด่วน "ทิ้งของเควสต์ทั้งหมด" ด้านบน
                    if (currentTab === 'quest' && displayItems.length > 0) {
                        html += `
                        <div style="display:flex; justify-content:space-between; align-items:center; padding:4px 7px; margin-bottom:6px; background:rgba(198,40,40,0.22); border:1px solid rgba(239,83,80,0.5); border-radius:5px;">
                            <span style="font-size:10px; color:#ffaaaa; font-weight:bold;">🏷️ ของเควสต์ในตัว: <b>${displayItems.length}</b> ชิ้น</span>
                            <button id="eni-destroy-all-quest-btn" style="background:#b71c1c; color:#fff; border:1px solid #ef5350; border-radius:4px; font-size:9.5px; font-weight:bold; padding:2px 8px; cursor:pointer; transition:0.2s;" title="ทิ้งไอเทมเควสต์ทั้งหมดในกระเป๋าเพื่อคืนพื้นที่">🗑️ ทิ้งทั้งหมด</button>
                        </div>
                        `;
                    }

                    displayItems.forEach(item => {
                        if (item && (item.t || item.name)) {
                            // ดึง Style รูปจากแคช Spritesheet หรือใช้ Emoji สำรอง
                            const iconStyle = getItemIconStyle(item.t, 26);
                            const iconInner = iconStyle 
                                ? `<span style="${iconStyle}"></span>` 
                                : `<span style="font-size:14px; line-height:26px;">${getItemFallbackEmoji(item.category, item.type)}</span>`;

                            const boundBadge = item.b ? '<span style="color:#ff5555; font-size:9px;" title="ผูกมัด">🔒</span> ' : '';
                            const questBadge = item.category === 'quest' ? '<span style="background:rgba(255,80,80,0.25); color:#ff8888; border:1px solid rgba(255,80,80,0.5); border-radius:3px; padding:0 3px; font-size:8.5px; font-weight:bold; line-height:12px; white-space:nowrap;">เควสต์</span> ' : '';
                            const gradeBadge = `<span style="background:${item.gradeColor}25; color:${item.gradeColor}; border:1px solid ${item.gradeColor}66; border-radius:3px; padding:0 3px; font-size:8.5px; font-weight:bold; line-height:12px; white-space:nowrap;">${item.gradeShortLabel || 'ขาว'}</span>`;

                            // ปุ่มดำเนินการ: ถ้าเป็นของเควสต์ให้มีปุ่ม "🗑️ ทิ้ง" (เนื่องจากขายและฝากไม่ได้)
                            // ตรวจสอบการเปรียบเทียบอุปกรณ์ (ถ้าเป็นหมวดสวมใส่)
                            const gearEval = (item.category === 'equip') ? evaluateGear(item) : null;
                            let upgradeBadge = '';
                            let equipBtn = '';

                            if (gearEval?.mark === 'better') {
                                upgradeBadge = `<span style="background:rgba(46,125,50,0.3); color:#81c784; border:1px solid #4caf50; border-radius:3px; padding:0 3px; font-size:8.5px; font-weight:bold; line-height:12px; white-space:nowrap;" title="ค่าพลังสูงกว่าชิ้นที่ใส่อยู่ (+${gearEval.diff} พลัง)">🟢 ⬆️ ดีกว่า (+${gearEval.diff})</span> `;
                                equipBtn = `<button class="eni-equip-btn" data-equip-id="${item.id}" style="background:linear-gradient(135deg, #ffd700, #ff9900); color:#000; border:none; border-radius:4px; cursor:pointer; font-size:10px; padding:3px 6px; font-weight:bold; height:24px;" title="สวมใส่ชิ้นนี้ทันที">⚔️ ใส่</button>`;
                            } else if (gearEval?.mark === 'later') {
                                upgradeBadge = `<span style="background:rgba(230,81,0,0.25); color:#ffb74d; border:1px solid #ffa726; border-radius:3px; padding:0 3px; font-size:8.5px; font-weight:bold; line-height:12px; white-space:nowrap;" title="ดีกว่าชิ้นที่ใส่ แต่ต้องรอเลเวล ${gearEval.reqLevel}">🟡 ⬆️ ดีกว่า (รอ Lv.${gearEval.reqLevel})</span> `;
                            }

                            // ปุ่มดำเนินการ
                            let actionButtons = '';
                            if (item.category === 'quest') {
                                actionButtons = `<button class="eni-destroy-btn" data-destroy-id="${item.id}" data-item-name="${item.name}" style="background:#c62828; color:white; border:1px solid #ef5350; border-radius:4px; cursor:pointer; font-size:10px; padding:3px 8px; font-weight:bold; height:24px; transition:0.2s;" title="ทิ้ง/ทำลายไอเทมเควสต์ชิ้นนี้">🗑️ ทิ้ง</button>`;
                            } else {
                                actionButtons = `
                                    ${equipBtn}
                                    <button class="eni-deposit-btn" data-deposit-id="${item.id}" style="background:#4caf50; color:white; border:none; border-radius:4px; cursor:pointer; font-size:10px; padding:3px 6px; font-weight:bold; height:24px;" title="ฝากเข้าคลัง">ฝาก</button>
                                    <button class="eni-sell-btn" data-sell-id="${item.id}" style="background:#ff3333; color:white; border:none; border-radius:4px; cursor:pointer; font-size:10px; padding:3px 6px; font-weight:bold; height:24px;" title="ขายให้ร้านค้า">ขาย</button>
                                `;
                            }

                            html += `
                            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #ff66b222; padding:5px 0;">
                                <div style="display:flex; align-items:center; gap:7px; max-width:235px; overflow:hidden;">
                                    <div style="width:26px; height:26px; min-width:26px; border-radius:4px; border:1px solid ${item.gradeColor}; background:#141414; display:flex; align-items:center; justify-content:center; overflow:hidden; box-shadow:0 0 4px ${item.gradeColor}44;">
                                        ${iconInner}
                                    </div>
                                    <div style="display:flex; flex-direction:column; overflow:hidden;">
                                        <div style="display:flex; align-items:center; gap:3px;">
                                            ${boundBadge}${questBadge}${upgradeBadge}
                                            <span style="font-size:11px; color:${item.nameColor}; font-weight:bold; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${item.name} (${item.t})">
                                                ${item.name}
                                            </span>
                                        </div>
                                        <div style="font-size:9px; color:#888; display:flex; align-items:center; gap:4px; margin-top:2px;">
                                            ${gradeBadge}
                                            <span>จำนวน: <b style="color:#fff;">${item.q || 1}</b> · <span style="color:#bbb;">${item.categoryName}</span></span>
                                        </div>
                                    </div>
                                </div>
                                <div style="display:flex; gap:3px;">
                                    ${actionButtons}
                                </div>
                            </div>
                            `;
                        }
                    });

                    invBox.innerHTML = html;
                }
            }
        }, 1000);
        
        updateUI(); // Set initial state
    }

    // ซิงก์ข้อมูลสถานะบอสโลกจากเซิร์ฟเวอร์แบบ Real-Time ส่งไปยัง LocalStorage ทุก 30 วินาที
    setInterval(async () => {
        try {
            const client = getGameClient();
            if (client && typeof sendGameRequest === 'function') {
                const res = await sendGameRequest(169, {});
                if (res && res.list) {
                    localStorage.setItem('pj_boss_tracker_live', JSON.stringify({
                        timestamp: Date.now(),
                        now: res.now,
                        list: res.list
                    }));
                }
            }
        } catch (e) {}
    }, 30000);

    // เรียกสร้าง UI ทันทีถ้า Body โหลดแล้ว หรือรอให้โหลดเสร็จก่อน
    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', createUI);
    } else {
        createUI();
    }

})();

