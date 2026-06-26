"use client";
import React, { useState, useRef, useCallback, useEffect } from "react";

// ============================================================
// AI Visual Archive V4 — 浅色简洁版
// 视觉: 浅色系 · 简洁轻松 · 纯文字无图标
// 新增: 骨架加载 · 卡片打磨 · 搜索 · 上传进度 · 排序
// 数据: Supabase 持久化
// ============================================================

const FONT_LINK_ID = "va-fonts";
const SB = "https://usdmrfbwmvjboxwipvix.supabase.co";
const SK = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVzZG1yZmJ3bXZqYm94d2lwdml4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwMDc3NjcsImV4cCI6MjA5NjU4Mzc2N30.4gbkWT2tjxq1udHMu6zXGSpezUlCLutN34FoTViYKOY";
const SH = { apikey: SK, Authorization: `Bearer ${SK}`, "Content-Type": "application/json" };

async function sbGet(t, q = "") { return (await fetch(`${SB}/rest/v1/${t}?${q}`, { headers: SH })).json(); }
async function sbInsert(t, d) { return (await fetch(`${SB}/rest/v1/${t}`, { method: "POST", headers: { ...SH, Prefer: "return=representation" }, body: JSON.stringify(d) })).json(); }
async function sbUpdate(t, id, d) { return (await fetch(`${SB}/rest/v1/${t}?id=eq.${id}`, { method: "PATCH", headers: { ...SH, Prefer: "return=representation" }, body: JSON.stringify(d) })).json(); }
async function sbDelete(t, id) { await fetch(`${SB}/rest/v1/${t}?id=eq.${id}`, { method: "DELETE", headers: SH }); }
async function sbUpload(b, p, blob, ct) { return (await fetch(`${SB}/storage/v1/object/${b}/${p}`, { method: "POST", headers: { apikey: SK, Authorization: `Bearer ${SK}`, "Content-Type": ct, "x-upsert": "true" }, body: blob })).ok; }
function sbUrl(b, p) { return `${SB}/storage/v1/object/public/${b}/${p}`; }

function compressImage(dataUrl, maxW = 1200, q = 0.7) {
  return new Promise((res) => { const img = new Image(); img.onload = () => { const c = document.createElement("canvas"); const r = Math.min(maxW / img.width, 1); c.width = img.width * r; c.height = img.height * r; c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); c.toBlob((b) => res(b), "image/jpeg", q); }; img.src = dataUrl; });
}
function urlToBase64(url) {
  return new Promise((res, rej) => { const img = new Image(); img.crossOrigin = "anonymous"; img.onload = () => { const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; c.getContext("2d").drawImage(img, 0, 0); res(c.toDataURL("image/jpeg", 0.9).split(",")[1]); }; img.onerror = rej; img.src = url; });
}
function fileToBase64(file) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res({ base64: r.result.split(",")[1], dataUrl: r.result, type: file.type }); r.onerror = rej; r.readAsDataURL(file); });
}

// ============================================================
// 多接口 Provider 系统 — localStorage 持久化,支持 Claude/GPT/Gemini/豆包/自定义
// ============================================================
const PROVIDER_KEY = "va_providers_v1";
const ACTIVE_KEY = "va_active_provider_v1";

// 预置模板:每个 type 对应一种请求格式
//   anthropic = Claude 原生格式
//   openai    = OpenAI Chat Completions(GPT/豆包/DeepSeek/通义/任何 openai 兼容接口)
//   gemini    = Google Gemini generateContent
//   server-openai = 通过本项目服务端代理调用 OpenAI 兼容接口,避免在浏览器暴露 Key
const PROVIDER_PRESETS = [
  { id:"doubao",  label:"豆包",    type:"server-openai", baseUrl:"/api/vision",                                           model:"doubao-1.5-vision-pro-32k-250115",  apiKey:"" },
  { id:"claude",  label:"Claude",  type:"anthropic", baseUrl:"https://api.anthropic.com/v1/messages",                    model:"claude-sonnet-4-20250514",          apiKey:"" },
  { id:"gpt4o",   label:"GPT-4o",  type:"openai",    baseUrl:"https://api.openai.com/v1/chat/completions",                model:"gpt-4o",                            apiKey:"" },
  { id:"gemini",  label:"Gemini",  type:"gemini",    baseUrl:"https://generativelanguage.googleapis.com/v1beta",          model:"gemini-2.0-flash",                  apiKey:"" },
];

function loadProviders() {
  try {
    const s = typeof localStorage!=="undefined" && localStorage.getItem(PROVIDER_KEY);
    if (s) {
      const saved = JSON.parse(s);
      if (Array.isArray(saved)) {
        const presets = new Map(PROVIDER_PRESETS.map(p => [p.id, p]));
        const savedById = new Map(saved.map(p => [p.id, p]));
        const mergedPresets = PROVIDER_PRESETS.map(p => {
          const old = savedById.get(p.id);
          return old ? { ...p, apiKey:old.apiKey || p.apiKey } : { ...p };
        });
        const custom = saved.filter(p => !presets.has(p.id));
        return [...mergedPresets, ...custom];
      }
    }
  } catch(e){}
  return PROVIDER_PRESETS.map(p => ({...p}));
}
function saveProviders(list) { try { localStorage.setItem(PROVIDER_KEY, JSON.stringify(list)); } catch(e){} }
function loadActiveId() {
  try {
    const saved = localStorage.getItem(ACTIVE_KEY);
    return !saved || saved === "claude" ? "doubao" : saved;
  } catch(e){ return "doubao"; }
}
function saveActiveId(id) { try { localStorage.setItem(ACTIVE_KEY, id); } catch(e){} }

// 通用调用入口:根据 provider.type 走不同格式,返回纯文本(JSON 字符串)
async function callVisionAPI(provider, base64, mediaType, systemText, maxTokens) {
  if (!provider) throw new Error("未选择 AI 接口,请到右上角「接口」配置");
  const { type, baseUrl, model, apiKey, label } = provider;

  if (type === "server-openai") {
    const r = await fetch(baseUrl || "/api/vision", {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ model, max_tokens:maxTokens, systemText, base64, mediaType }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.error) throw new Error(`[${label}] ${d.error || `HTTP ${r.status}`}`);
    return d.content || "";
  }

  if (!apiKey || !apiKey.trim()) throw new Error(`「${label}」的 API Key 未填写,请到右上角「接口」配置`);

  if (type === "anthropic") {
    const r = await fetch(baseUrl, {
      method:"POST",
      headers:{ "Content-Type":"application/json", "x-api-key":apiKey, "anthropic-version":"2023-06-01", "anthropic-dangerous-direct-browser-access":"true" },
