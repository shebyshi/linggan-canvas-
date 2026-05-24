const STORAGE_KEY = "workflow-canvas-v2";
const OLD_STORAGE_KEY = "workflow-canvas-v1";
const AI_SETTINGS_KEY = "workflow-canvas-ai-settings-v1";

const viewport = document.getElementById("viewport");
const canvas = document.getElementById("canvas");
const groupsLayer = document.getElementById("groupsLayer");
const linksSvg = document.getElementById("links");
const selectionBox = document.getElementById("selectionBox");
const zoomLabel = document.getElementById("zoomLabel");
const modeText = document.getElementById("modeText");
const modeDot = document.getElementById("modeDot");
const undoActionButton = document.getElementById("undoAction");
const createGroupButton = document.getElementById("createGroup");
const ungroupSelectedButton = document.getElementById("ungroupSelected");
const deleteSelectedButton = document.getElementById("deleteSelected");
const imageInput = document.getElementById("imageInput");
const videoInput = document.getElementById("videoInput");
const jsonInput = document.getElementById("jsonInput");
const searchInput = document.getElementById("searchInput");
const contextMenu = document.getElementById("contextMenu");
const aiSettingsButton = document.getElementById("aiSettings");
const aiGenerateButton = document.getElementById("aiGenerate");
const aiModal = document.getElementById("aiModal");
const closeAiModalButton = document.getElementById("closeAiModal");
const skipAiSettingsButton = document.getElementById("skipAiSettings");
const saveAiSettingsButton = document.getElementById("saveAiSettings");
const testAiSettingsButton = document.getElementById("testAiSettings");
const aiTextGenerateButton = document.getElementById("aiTextGenerate");
const aiImageGenerateButton = document.getElementById("aiImageGenerate");
const aiApiKeyInput = document.getElementById("aiApiKey");
const aiModelInput = document.getElementById("aiModel");
const aiEndpointInput = document.getElementById("aiEndpoint");
const aiPromptInput = document.getElementById("aiPrompt");
const aiImageModelInput = document.getElementById("aiImageModel");
const aiImageEndpointInput = document.getElementById("aiImageEndpoint");
const aiImageCountInput = document.getElementById("aiImageCount");

const text = {
  chooseMode: "\u9009\u62e9\u6a21\u5f0f",
  task: "\u4efb\u52a1\u8282\u70b9",
  note: "\u5907\u6ce8",
  image: "\u56fe\u7247",
  video: "\u89c6\u9891",
  taskBody: "\u63cf\u8ff0\u8fd9\u4e2a\u6b65\u9aa4\u8981\u505a\u4ec0\u4e48\u3002",
  noteBody: "\u5199\u4e0b\u60f3\u6cd5\u3001\u9650\u5236\u6216\u4e0b\u4e00\u6b65\u3002",
  selectFirst: "\u5148\u70b9\u9009\u4e00\u4e2a\u8282\u70b9\uff0c\u518d\u5220\u9664\u3002",
  imageAlt: "\u753b\u5e03\u56fe\u7247",
  imageError: "\u56fe\u7247\u52a0\u8f7d\u5931\u8d25",
  videoError: "\u89c6\u9891\u52a0\u8f7d\u5931\u8d25",
  notePlaceholder: "\u5199\u5907\u6ce8...",
  taskPlaceholder: "\u5199\u6b65\u9aa4\u8bf4\u660e...",
  start: "\u5f00\u59cb",
  startBody: "\u628a\u5de5\u4f5c\u6d41\u7684\u7b2c\u4e00\u4e2a\u6b65\u9aa4\u653e\u5728\u8fd9\u91cc\u3002",
  noteBodyInitial: "\u53ef\u4ee5\u8bb0\u5f55\u80cc\u666f\u3001\u98ce\u9669\u3001\u7075\u611f\u6216\u5f85\u786e\u8ba4\u4e8b\u9879\u3002",
  clearConfirm: "\u786e\u5b9a\u6e05\u7a7a\u5f53\u524d\u753b\u5e03\u5417\uff1f",
  invalidJson: "\u8fd9\u4e2a JSON \u6587\u4ef6\u4e0d\u662f\u6709\u6548\u7684\u753b\u5e03\u6587\u4ef6\u3002",
  noSearch: "\u6ca1\u6709\u627e\u5230\u5339\u914d\u7684\u8282\u70b9\u3002",
  resetRatio: "\u6309\u6bd4\u4f8b\u91cd\u7f6e\u5927\u5c0f",
  fitCover: "\u94fa\u6ee1\u88c1\u5207",
  fitContain: "\u5b8c\u6574\u663e\u793a",
};

const MEDIA_SIZE = {
  minWidth: 150,
  minHeight: 110,
  maxWidth: 520,
  maxHeight: 420,
  defaultWidth: 240,
  defaultHeight: 170,
};

const HISTORY_LIMIT = 5;

let state = {
  nodes: [],
  links: [],
  groups: [],
  view: { x: 420, y: 220, scale: 1 },
};

let selectedId = null;
let selectedLinkId = null;
let selectedIds = new Set();
let drag = null;
let saveTimer = null;
let dragOverDepth = 0;
let spacePan = false;
let altCopyMode = false;
let undoStack = [];
let suspendHistory = false;

function cloneState(value = state) {
  return JSON.parse(JSON.stringify(value));
}

function cloneCanvasContent(value = state) {
  return cloneState({
    nodes: value.nodes,
    links: value.links,
    groups: value.groups || [],
  });
}

function sameState(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function isTextEditingElement(element) {
  if (!element) return false;
  if (element.tagName === "TEXTAREA") return !element.readOnly && !element.disabled;
  if (element.tagName !== "INPUT") return false;
  const type = (element.type || "text").toLowerCase();
  const editableTypes = ["email", "number", "password", "search", "tel", "text", "url"];
  return editableTypes.includes(type) && !element.readOnly && !element.disabled;
}

function pushHistorySnapshot(snapshot, options = {}) {
  const requireChanged = options.requireChanged !== false;
  const current = cloneCanvasContent();
  if (suspendHistory || (requireChanged && sameState(snapshot, current))) return;
  const last = undoStack[undoStack.length - 1];
  if (last && sameState(last, snapshot)) return;
  undoStack.push(cloneState(snapshot));
  if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
}

function commitHistory() {
  pushHistorySnapshot(cloneCanvasContent(), { requireChanged: false });
}

function undoLastChange() {
  const previous = undoStack.pop();
  if (!previous) return;
  suspendHistory = true;
  state = {
    ...state,
    nodes: cloneState(previous.nodes),
    links: cloneState(previous.links),
    groups: cloneState(previous.groups || []),
  };
  selectedId = null;
  selectedLinkId = null;
  selectedIds.clear();
  hideContextMenu();
  applyView();
  render();
  saveNow();
  suspendHistory = false;
}

function isUndoShortcut(event) {
  return (
    (event.ctrlKey || event.metaKey) &&
    ((event.key || "").toLowerCase() === "z" || event.code === "KeyZ")
  );
}

function uid(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function screenToWorld(clientX, clientY) {
  const rect = viewport.getBoundingClientRect();
  return {
    x: (clientX - rect.left - state.view.x) / state.view.scale,
    y: (clientY - rect.top - state.view.y) / state.view.scale,
  };
}

function worldToScreen(x, y) {
  const rect = viewport.getBoundingClientRect();
  return {
    x: rect.left + state.view.x + x * state.view.scale,
    y: rect.top + state.view.y + y * state.view.scale,
  };
}

function applyView() {
  const transform = `translate(${state.view.x}px, ${state.view.y}px) scale(${state.view.scale})`;
  canvas.style.transform = transform;
  groupsLayer.style.transform = transform;
  linksSvg.style.transform = transform;
  const gridSize = 24 * state.view.scale;
  viewport.style.backgroundSize = `${gridSize}px ${gridSize}px`;
  viewport.style.backgroundPosition = `${state.view.x}px ${state.view.y}px`;
  zoomLabel.textContent = `${Math.round(state.view.scale * 100)}%`;
  scheduleSave();
}

function scheduleSave() {
  if (suspendHistory) return;
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, 120);
}

function saveNow() {
  window.clearTimeout(saveTimer);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function hideContextMenu() {
  contextMenu.hidden = true;
  contextMenu.innerHTML = "";
}

function resetMode() {
  modeDot.classList.remove("connecting");
  modeText.textContent = text.chooseMode;
  hideContextMenu();
  render();
}

function refreshNodeClasses() {
  for (const element of canvas.querySelectorAll(".node")) {
    const id = element.dataset.id;
    element.classList.toggle("selected", selectedId === id || selectedIds.has(id));
    element.classList.toggle("connect-source", false);
  }
  refreshSelectionActions();
}

function getSelectedGroupIds() {
  const groupIds = new Set();
  for (const id of selectedIds) {
    const group = getGroupForNode(id);
    if (group) groupIds.add(group.id);
  }
  if (selectedId) {
    const group = getGroupForNode(selectedId);
    if (group) groupIds.add(group.id);
  }
  return [...groupIds];
}

function refreshSelectionActions() {
  if (!ungroupSelectedButton) return;
  const hasGroupSelection = getSelectedGroupIds().length > 0;
  ungroupSelectedButton.disabled = !hasGroupSelection;
  ungroupSelectedButton.classList.toggle("active", hasGroupSelection);
}

function setSingleSelection(id) {
  selectedId = id;
  selectedIds = id ? new Set([id]) : new Set();
  selectedLinkId = null;
  refreshNodeClasses();
  refreshLinkClasses();
}

function setMultiSelection(ids) {
  selectedIds = new Set(ids);
  selectedId = ids[ids.length - 1] || null;
  selectedLinkId = null;
  refreshNodeClasses();
  refreshLinkClasses();
}

function clearSelection() {
  selectedId = null;
  selectedLinkId = null;
  selectedIds.clear();
  refreshNodeClasses();
  refreshLinkClasses();
}

function setSpacePan(isActive) {
  spacePan = isActive;
  document.body.classList.toggle("space-pan", spacePan);
  if (spacePan) hideContextMenu();
}

function beginPan(event) {
  clearSelection();
  viewport.classList.add("dragging");
  drag = {
    type: "pan",
    startX: event.clientX,
    startY: event.clientY,
    viewX: state.view.x,
    viewY: state.view.y,
  };
}

function updateSelectionBox(start, current) {
  const left = Math.min(start.x, current.x);
  const top = Math.min(start.y, current.y);
  const width = Math.abs(current.x - start.x);
  const height = Math.abs(current.y - start.y);
  selectionBox.hidden = false;
  selectionBox.style.left = `${left}px`;
  selectionBox.style.top = `${top}px`;
  selectionBox.style.width = `${width}px`;
  selectionBox.style.height = `${height}px`;
}

function nodeIntersectsRect(node, rect) {
  const size = getNodeSize(node);
  const nodeRect = {
    left: node.x,
    right: node.x + size.width,
    top: node.y,
    bottom: node.y + size.height,
  };
  return !(
    nodeRect.right < rect.left ||
    nodeRect.left > rect.right ||
    nodeRect.bottom < rect.top ||
    nodeRect.top > rect.bottom
  );
}

function beginMarqueeSelect(event) {
  const screenStart = {
    x: event.clientX - viewport.getBoundingClientRect().left,
    y: event.clientY - viewport.getBoundingClientRect().top,
  };
  const worldStart = screenToWorld(event.clientX, event.clientY);
  clearSelection();
  hideContextMenu();
  viewport.classList.add("selecting");
  drag = {
    type: "select",
    screenStart,
    screenCurrent: screenStart,
    worldStart,
    worldCurrent: worldStart,
    dirty: false,
  };
  updateSelectionBox(screenStart, screenStart);
}

function createNodeAt(type, point, extra = {}) {
  commitHistory();
  const isMedia = type === "image" || type === "video";
  const width = isMedia ? extra.width || MEDIA_SIZE.defaultWidth : undefined;
  const height = isMedia ? extra.height || MEDIA_SIZE.defaultHeight : undefined;
  const base = {
    id: uid("node"),
    type,
    color: type === "note" ? "amber" : "slate",
    x: point.x - (isMedia ? width / 2 : 115) + Math.random() * 24,
    y: point.y - (isMedia ? height / 2 : 64) + Math.random() * 24,
    width,
    height,
    title: type === "note" ? text.note : type === "image" ? text.image : type === "video" ? text.video : text.task,
    text: type === "note" ? text.noteBody : text.taskBody,
  };
  state.nodes.push({ ...base, ...extra });
  setSingleSelection(base.id);
  render();
  scheduleSave();
}

function createNode(type, extra = {}) {
  const center = screenToWorld(window.innerWidth / 2, window.innerHeight / 2);
  createNodeAt(type, center, extra);
}

function fitMediaSize(naturalWidth, naturalHeight) {
  const width = Number(naturalWidth);
  const height = Number(naturalHeight);
  if (!width || !height) {
    return {
      width: MEDIA_SIZE.defaultWidth,
      height: MEDIA_SIZE.defaultHeight,
      naturalWidth: undefined,
      naturalHeight: undefined,
    };
  }

  const scale = Math.min(
    MEDIA_SIZE.maxWidth / width,
    MEDIA_SIZE.maxHeight / height,
    Math.max(MEDIA_SIZE.minWidth / width, MEDIA_SIZE.minHeight / height, 1),
  );
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
    naturalWidth: width,
    naturalHeight: height,
  };
}

function addImageFile(file, point) {
  if (!file || !file.type.startsWith("image/")) return;

  const reader = new FileReader();
  reader.onload = () => {
    const image = new Image();
    image.onload = () => {
      createNodeAt("image", point, {
        color: "slate",
        title: file.name.replace(/\.[^.]+$/, ""),
        text: "",
        src: reader.result,
        ...fitMediaSize(image.naturalWidth, image.naturalHeight),
      });
    };
    image.onerror = () => {
      createNodeAt("image", point, {
        color: "slate",
        title: file.name.replace(/\.[^.]+$/, ""),
        text: "",
        src: reader.result,
      });
    };
    image.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function addTextNote(content, point) {
  const value = String(content || "").trim();
  if (!value) return;
  createNodeAt("note", point, {
    color: "amber",
    title: text.note,
    text: value,
  });
}

function loadAiSettings() {
  try {
    return {
      endpoint: "https://api.openai.com/v1/responses",
      model: "gpt-4.1-mini",
      imageEndpoint: "https://api.openai.com/v1/images/generations",
      imageModel: "gpt-image-1",
      imageCount: "1",
      prompt: "根据选中的节点内容，整理成更清晰的执行建议。",
      apiKey: "",
      ...JSON.parse(localStorage.getItem(AI_SETTINGS_KEY) || "{}"),
    };
  } catch {
    return {
      endpoint: "https://api.openai.com/v1/responses",
      model: "gpt-4.1-mini",
      imageEndpoint: "https://api.openai.com/v1/images/generations",
      imageModel: "gpt-image-1",
      imageCount: "1",
      prompt: "根据选中的节点内容，整理成更清晰的执行建议。",
      apiKey: "",
    };
  }
}

function saveAiSettings() {
  const settings = {
    apiKey: aiApiKeyInput.value.trim(),
    model: aiModelInput.value.trim() || "gpt-4.1-mini",
    endpoint: aiEndpointInput.value.trim() || "https://api.openai.com/v1/responses",
    imageModel: aiImageModelInput.value.trim() || "gpt-image-1",
    imageEndpoint:
      aiImageEndpointInput.value.trim() || "https://api.openai.com/v1/images/generations",
    imageCount: aiImageCountInput.value || "1",
    prompt: aiPromptInput.value.trim() || "根据选中的节点内容，整理成更清晰的执行建议。",
  };
  localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(settings));
  return settings;
}

function fillAiSettingsForm() {
  const settings = loadAiSettings();
  aiApiKeyInput.value = settings.apiKey || "";
  aiModelInput.value = settings.model || "";
  aiEndpointInput.value = settings.endpoint || "";
  aiPromptInput.value = settings.prompt || "";
  aiImageModelInput.value = settings.imageModel || "gpt-image-1";
  aiImageEndpointInput.value =
    settings.imageEndpoint || "https://api.openai.com/v1/images/generations";
  aiImageCountInput.value = settings.imageCount || "1";
}

function openAiModal() {
  fillAiSettingsForm();
  aiModal.hidden = false;
}

function closeAiModal() {
  aiModal.hidden = true;
}

function getSelectedNodesForAi() {
  const ids = selectedIds.size ? [...selectedIds] : selectedId ? [selectedId] : [];
  return ids
    .map((id) => state.nodes.find((node) => node.id === id))
    .filter((node) => node && node.type !== "image" && node.type !== "video");
}

function getSelectedImageNodesForAi() {
  const ids = selectedIds.size ? [...selectedIds] : selectedId ? [selectedId] : [];
  return ids
    .map((id) => state.nodes.find((node) => node.id === id))
    .filter((node) => node?.type === "image" && node.src);
}

function buildAiInput(settings, selectedNodes) {
  const source = selectedNodes.length
    ? selectedNodes
        .map((node, index) => `节点 ${index + 1}\n标题：${node.title || ""}\n内容：${node.text || ""}`)
        .join("\n\n")
    : "当前没有选中可读取文本的节点，请直接给出一个灵感画布使用建议。";
  return `${settings.prompt}\n\n${source}`;
}

function readResponseText(data) {
  if (typeof data.output_text === "string") return data.output_text;
  const chunks = [];
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (typeof content.text === "string") chunks.push(content.text);
    }
  }
  return chunks.join("\n").trim();
}

async function callAi(settings, input) {
  const response = await fetch(settings.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model,
      input,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.error?.message || `接口请求失败：${response.status}`;
    throw new Error(message);
  }
  return readResponseText(data) || "接口返回成功，但没有读取到文本内容。";
}

function dataUrlToBlob(dataUrl) {
  const [meta, base64] = String(dataUrl || "").split(",");
  const mime = meta.match(/data:(.*?);base64/)?.[1] || "image/png";
  const binary = atob(base64 || "");
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mime });
}

async function imageSrcToBlob(src) {
  if (String(src).startsWith("data:")) return dataUrlToBlob(src);
  const response = await fetch(src);
  if (!response.ok) throw new Error("读取选中图片失败，无法提交改图。");
  return response.blob();
}

function getImageSizeFromSrc(src) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(fitMediaSize(image.naturalWidth, image.naturalHeight));
    image.onerror = () => resolve(fitMediaSize());
    image.src = src;
  });
}

function extractImageSources(data) {
  return (data.data || [])
    .map((item) => item.b64_json || item.url || "")
    .filter(Boolean)
    .map((value) => (value.startsWith("http") || value.startsWith("data:") ? value : `data:image/png;base64,${value}`));
}

async function callAiImages(settings, prompt, sourceImages) {
  const imageCount = Math.max(1, Math.min(4, Number(settings.imageCount) || 1));
  const hasSourceImages = sourceImages.length > 0;
  const endpoint = hasSourceImages
    ? settings.imageEndpoint.replace(/\/images\/generations$/, "/images/edits")
    : settings.imageEndpoint;

  const form = new FormData();
  form.append("model", settings.imageModel || "gpt-image-1");
  form.append("prompt", prompt);
  form.append("n", String(imageCount));
  form.append("size", "1024x1024");

  if (hasSourceImages) {
    const images = sourceImages.slice(0, 16);
    for (let index = 0; index < images.length; index += 1) {
      const node = images[index];
      const filename = `${node.title || `image-${index + 1}`}`.replace(/[\\/:*?"<>|]/g, "-");
      form.append("image", await imageSrcToBlob(node.src), `${filename}.png`);
    }
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: form,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.error?.message || `图片接口请求失败：${response.status}`;
    throw new Error(message);
  }
  const sources = extractImageSources(data);
  if (!sources.length) throw new Error("图片接口返回成功，但没有读取到图片。");
  return sources;
}

async function generateWithAi() {
  const settings = saveAiSettings();
  if (!settings.apiKey) {
    openAiModal();
    window.alert("AI 接口是可选功能。不填写 API Key 也可以继续使用画布；需要 AI 生成时再填写即可。");
    return;
  }
  const selectedNodes = getSelectedNodesForAi();
  const center = screenToWorld(window.innerWidth / 2, window.innerHeight / 2);
  aiGenerateButton.disabled = true;
  modeText.textContent = "AI 生成中...";
  try {
    const result = await callAi(settings, buildAiInput(settings, selectedNodes));
    createNodeAt("note", center, {
      color: "blue",
      title: "AI 生成",
      text: result,
    });
    modeText.textContent = text.chooseMode;
  } catch (error) {
    window.alert(error.message || "AI 接口调用失败。");
    modeText.textContent = text.chooseMode;
  } finally {
    aiGenerateButton.disabled = false;
  }
}

async function generateImagesWithAi() {
  const settings = saveAiSettings();
  if (!settings.apiKey) {
    window.alert("AI 图片功能是可选的；需要生成或改图时，请先填写 API Key。");
    return;
  }
  const prompt = settings.prompt.trim();
  if (!prompt) {
    window.alert("请先写清楚你要 AI 生成或修改什么。");
    return;
  }

  const sourceImages = getSelectedImageNodesForAi();
  const center = screenToWorld(window.innerWidth / 2, window.innerHeight / 2);
  aiImageGenerateButton.disabled = true;
  modeText.textContent = sourceImages.length ? "AI 改图中..." : "AI 生图中...";
  try {
    const sources = await callAiImages(settings, prompt, sourceImages);
    for (let index = 0; index < sources.length; index += 1) {
      const src = sources[index];
      const size = await getImageSizeFromSrc(src);
      createNodeAt("image", { x: center.x + index * 42, y: center.y + index * 42 }, {
        color: "slate",
        title: sourceImages.length ? `AI 改图 ${index + 1}` : `AI 生图 ${index + 1}`,
        text: prompt,
        src,
        ...size,
      });
    }
    closeAiModal();
    modeText.textContent = text.chooseMode;
  } catch (error) {
    window.alert(error.message || "AI 图片接口调用失败。");
    modeText.textContent = text.chooseMode;
  } finally {
    aiImageGenerateButton.disabled = false;
  }
}

function addVideoFile(file, point) {
  if (!file || !file.type.startsWith("video/")) return;

  const reader = new FileReader();
  reader.onload = () => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      createNodeAt("video", point, {
        color: "slate",
        title: file.name.replace(/\.[^.]+$/, ""),
        text: "",
        src: reader.result,
        ...fitMediaSize(video.videoWidth, video.videoHeight),
      });
    };
    video.onerror = () => {
      createNodeAt("video", point, {
        color: "slate",
        title: file.name.replace(/\.[^.]+$/, ""),
        text: "",
        src: reader.result,
      });
    };
    video.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function deleteNode(id) {
  deleteNodes([id]);
}

function deleteNodes(ids) {
  const targets = new Set(ids.filter(Boolean));
  if (!targets.size) return;
  commitHistory();
  state.nodes = state.nodes.filter((node) => !targets.has(node.id));
  state.links = state.links.filter((link) => !targets.has(link.from) && !targets.has(link.to));
  state.groups = (state.groups || [])
    .map((group) => ({
      ...group,
      nodeIds: (group.nodeIds || []).filter((id) => !targets.has(id)),
    }))
    .filter((group) => group.nodeIds.length);
  selectedIds = new Set([...selectedIds].filter((id) => !targets.has(id)));
  if (selectedId && targets.has(selectedId)) selectedId = selectedIds.size ? [...selectedIds][0] : null;
  selectedLinkId = null;
  hideContextMenu();
  render();
  scheduleSave();
}

function deleteLink(id) {
  commitHistory();
  state.links = state.links.filter((link) => link.id !== id);
  if (selectedLinkId === id) selectedLinkId = null;
  renderLinks();
  scheduleSave();
}

function deleteSelectedNode() {
  const targets = selectedIds.size ? [...selectedIds] : selectedId ? [selectedId] : [];
  if (!targets.length) {
    window.alert(text.selectFirst);
    return;
  }
  deleteNodes(targets);
}

function createNodeCopy(node, offset = 28) {
  return {
    ...node,
    id: uid("node"),
    x: node.x + offset,
    y: node.y + offset,
  };
}

function duplicateNode(id) {
  const node = state.nodes.find((item) => item.id === id);
  if (!node) return;
  commitHistory();
  const copy = createNodeCopy(node);
  state.nodes.push(copy);
  setSingleSelection(copy.id);
  hideContextMenu();
  render();
  scheduleSave();
}

function updateNode(id, patch, options = {}) {
  const node = state.nodes.find((item) => item.id === id);
  if (!node) return;
  if (options.history !== false) commitHistory();
  Object.assign(node, patch);
  renderLinks();
  scheduleSave();
}

function setNodeColor(id, color) {
  updateNode(id, { color });
  render();
}

function resetMediaRatio(id) {
  const node = state.nodes.find((item) => item.id === id);
  if (!node || (node.type !== "image" && node.type !== "video")) return;
  commitHistory();
  const nextSize = fitMediaSize(node.naturalWidth, node.naturalHeight);
  node.width = nextSize.width;
  node.height = nextSize.height;
  hideContextMenu();
  render();
  saveNow();
}

function toggleMediaFit(id) {
  const node = state.nodes.find((item) => item.id === id);
  if (!node || (node.type !== "image" && node.type !== "video")) return;
  commitHistory();
  node.fit = node.fit === "cover" ? "contain" : "cover";
  hideContextMenu();
  render();
  saveNow();
}

function getNodeSize(node) {
  if (node.type === "image" || node.type === "video") {
    return {
      width: Number(node.width) || MEDIA_SIZE.defaultWidth,
      height: Number(node.height) || MEDIA_SIZE.defaultHeight,
    };
  }
  return { width: 230, height: 128 };
}

function getNodesBounds(ids, padding = 26) {
  const targets = ids
    .map((id) => state.nodes.find((node) => node.id === id))
    .filter(Boolean);
  if (!targets.length) return null;
  const bounds = targets.reduce(
    (acc, node) => {
      const size = getNodeSize(node);
      return {
        left: Math.min(acc.left, node.x),
        top: Math.min(acc.top, node.y),
        right: Math.max(acc.right, node.x + size.width),
        bottom: Math.max(acc.bottom, node.y + size.height),
      };
    },
    { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity },
  );
  return {
    x: bounds.left - padding,
    y: bounds.top - padding - 38,
    width: bounds.right - bounds.left + padding * 2,
    height: bounds.bottom - bounds.top + padding * 2 + 38,
  };
}

function createGroupFromSelection() {
  const ids = [...selectedIds].filter((id) => state.nodes.some((node) => node.id === id));
  if (ids.length < 2) {
    window.alert("请先框选至少两个节点。");
    return;
  }
  commitHistory();
  state.groups = state.groups || [];
  const group = {
    id: uid("group"),
    nodeIds: ids,
  };
  state.groups.push(group);
  setMultiSelection(ids);
  render();
  scheduleSave();
}

function ungroup(id) {
  if (!state.groups?.some((group) => group.id === id)) return;
  commitHistory();
  state.groups = state.groups.filter((group) => group.id !== id);
  render();
  scheduleSave();
}

function ungroupSelected() {
  const groupIds = getSelectedGroupIds();
  if (!groupIds.length) return;
  const targets = new Set(groupIds);
  commitHistory();
  state.groups = (state.groups || []).filter((group) => !targets.has(group.id));
  render();
  scheduleSave();
}

function renderGroup(group) {
  const element = document.createElement("section");
  element.className = "group-box";
  element.dataset.id = group.id;
  element.style.transform = `translate(${group.x}px, ${group.y}px)`;
  element.style.width = `${group.width}px`;
  element.style.height = `${group.height}px`;

  const header = document.createElement("div");
  header.className = "group-header";
  header.textContent = group.title || group.id;

  const remove = document.createElement("button");
  remove.className = "group-remove";
  remove.type = "button";
  remove.title = "取消分组";
  remove.setAttribute("aria-label", "取消分组");
  remove.innerHTML = "&times;";
  remove.addEventListener("pointerdown", (event) => event.stopPropagation());
  remove.addEventListener("click", (event) => {
    event.stopPropagation();
    ungroup(group.id);
  });

  header.appendChild(remove);
  header.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    hideContextMenu();
    const start = screenToWorld(event.clientX, event.clientY);
    const nodePositions = group.nodeIds
      .map((id) => {
        const node = state.nodes.find((item) => item.id === id);
        const nodeElement = canvas.querySelector(`[data-id="${id}"]`);
        return node && nodeElement
          ? { id, nodeX: node.x, nodeY: node.y, element: nodeElement }
          : null;
      })
      .filter(Boolean);
    element.setPointerCapture(event.pointerId);
    drag = {
      type: "group",
      before: cloneCanvasContent(),
      id: group.id,
      startX: start.x,
      startY: start.y,
      groupX: group.x,
      groupY: group.y,
      element,
      nodePositions,
      dirty: false,
    };
    viewport.classList.add("dragging");
  });

  element.appendChild(header);
  return element;
}

function renderGroups() {
  groupsLayer.innerHTML = "";
  state.groups = (state.groups || []).filter((group) =>
    (group.nodeIds || []).filter((id) => state.nodes.some((node) => node.id === id)).length > 1,
  );
  for (const group of state.groups) {
    group.nodeIds = group.nodeIds.filter((id) => state.nodes.some((node) => node.id === id));
  }
}

function getGroupForNode(id) {
  return (state.groups || []).find((group) => (group.nodeIds || []).includes(id));
}

function getNodeSelectionScope(id) {
  const group = getGroupForNode(id);
  return group ? group.nodeIds.filter((nodeId) => state.nodes.some((node) => node.id === nodeId)) : [id];
}

function toggleSelectionScope(ids) {
  const next = new Set(selectedIds);
  const allSelected = ids.every((id) => next.has(id));
  for (const id of ids) {
    if (allSelected) next.delete(id);
    else next.add(id);
  }
  setMultiSelection([...next]);
}

function getNodeCenter(id) {
  const node = state.nodes.find((item) => item.id === id);
  if (!node) return null;
  const size = getNodeSize(node);
  return { x: node.x + size.width / 2, y: node.y + size.height / 2 };
}

function getPortPoint(id, port = "center") {
  const node = state.nodes.find((item) => item.id === id);
  if (!node) return null;
  const size = getNodeSize(node);
  const points = {
    top: { x: node.x + size.width / 2, y: node.y },
    right: { x: node.x + size.width, y: node.y + size.height / 2 },
    bottom: { x: node.x + size.width / 2, y: node.y + size.height },
    left: { x: node.x, y: node.y + size.height / 2 },
    center: { x: node.x + size.width / 2, y: node.y + size.height / 2 },
  };
  return points[port] || points.center;
}

function inferPorts(fromId, toId) {
  const from = getNodeCenter(fromId);
  const to = getNodeCenter(toId);
  if (!from || !to) return { fromPort: "right", toPort: "left" };
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { fromPort: "right", toPort: "left" }
      : { fromPort: "left", toPort: "right" };
  }
  return dy >= 0
    ? { fromPort: "bottom", toPort: "top" }
    : { fromPort: "top", toPort: "bottom" };
}

function portVector(port) {
  return {
    top: { x: 0, y: -1 },
    right: { x: 1, y: 0 },
    bottom: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    center: { x: 1, y: 0 },
  }[port] || { x: 1, y: 0 };
}

function linkPath(from, to, fromPort = "right", toPort = "left") {
  const fromVec = portVector(fromPort);
  const toVec = portVector(toPort);
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const handle = Math.max(70, Math.min(180, distance * 0.38));
  const c1 = { x: from.x + fromVec.x * handle, y: from.y + fromVec.y * handle };
  const c2 = { x: to.x + toVec.x * handle, y: to.y + toVec.y * handle };
  return `M ${from.x} ${from.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${to.x} ${to.y}`;
}

function refreshLinkClasses() {
  for (const path of linksSvg.querySelectorAll(".link-path")) {
    path.classList.toggle("selected", path.dataset.id === selectedLinkId);
  }
}

function renderLinks() {
  linksSvg.innerHTML = "";
  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  defs.innerHTML = `
    <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#63758b"></path>
    </marker>
  `;
  linksSvg.appendChild(defs);

  for (const link of state.links) {
    const fallback = inferPorts(link.from, link.to);
    const fromPort = link.fromPort || fallback.fromPort;
    const toPort = link.toPort || fallback.toPort;
    const from = getPortPoint(link.from, fromPort);
    const to = getPortPoint(link.to, toPort);
    if (!from || !to) continue;

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", linkPath(from, to, fromPort, toPort));
    path.setAttribute("class", "link-path");
    path.classList.toggle("selected", selectedLinkId === link.id);
    path.dataset.id = link.id;
    path.setAttribute("marker-end", "url(#arrow)");
    path.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
      hideContextMenu();
      if (spacePan) {
        beginPan(event);
        return;
      }
      selectedId = null;
      selectedIds.clear();
      selectedLinkId = link.id;
      refreshNodeClasses();
      refreshLinkClasses();
    });
    path.addEventListener("dblclick", (event) => {
      event.stopPropagation();
      deleteLink(link.id);
    });
    linksSvg.appendChild(path);
  }

  if (drag?.type === "connect") {
    const preview = document.createElementNS("http://www.w3.org/2000/svg", "path");
    preview.setAttribute(
      "d",
      linkPath(drag.fromPoint, drag.toPoint, drag.fromPort, "left"),
    );
    preview.setAttribute("class", "link-path preview");
    linksSvg.appendChild(preview);
  }
}

function renderNode(node) {
  const element = document.createElement("article");
  element.className = `node ${node.type}`;
  element.dataset.id = node.id;
  element.dataset.color = node.color || "slate";
  if (node.type === "image" || node.type === "video") {
    element.dataset.fit = node.fit === "cover" ? "cover" : "contain";
  }
  const nodeSize = getNodeSize(node);
  element.style.transform = `translate(${node.x}px, ${node.y}px)`;
  if (node.type === "image" || node.type === "video") {
    element.style.width = `${nodeSize.width}px`;
  }

  for (const port of ["top", "right", "bottom", "left"]) {
    const portButton = document.createElement("span");
    portButton.className = `connection-port ${port}`;
    portButton.dataset.nodeId = node.id;
    portButton.dataset.port = port;
    portButton.title = "\u62d6\u52a8\u8fde\u7ebf";
    portButton.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      event.stopPropagation();
      hideContextMenu();
      modeDot.classList.add("connecting");
      modeText.textContent = "\u62d6\u52a8\u5230\u53e6\u4e00\u4e2a\u8282\u70b9\u7684\u8fde\u63a5\u70b9";
      setSingleSelection(node.id);
      const fromPoint = getPortPoint(node.id, port);
      const toPoint = screenToWorld(event.clientX, event.clientY);
      drag = {
        type: "connect",
        before: cloneCanvasContent(),
        fromId: node.id,
        fromPort: port,
        fromPoint,
        toPoint,
        dirty: false,
      };
      viewport.classList.add("connecting-drag");
      refreshNodeClasses();
      renderLinks();
    });
    element.appendChild(portButton);
  }
  element.classList.toggle("selected", selectedId === node.id || selectedIds.has(node.id));
  element.classList.toggle("connect-source", false);

  const header = document.createElement("div");
  header.className = "node-header";

  const title = document.createElement("input");
  title.className = "node-title";
  title.value = node.title;
  title.readOnly = true;
  let titleBeforeEdit = null;
  title.addEventListener("focus", () => {
    if (title.readOnly) return;
    titleBeforeEdit = cloneCanvasContent();
  });
  title.addEventListener("input", () =>
    updateNode(node.id, { title: title.value }, { history: false }),
  );
  title.addEventListener("dblclick", (event) => {
    event.stopPropagation();
    title.readOnly = false;
    title.focus();
    title.select();
  });
  title.addEventListener("blur", () => {
    if (titleBeforeEdit) {
      pushHistorySnapshot(titleBeforeEdit);
      titleBeforeEdit = null;
    }
    title.readOnly = true;
  });

  const remove = document.createElement("button");
  remove.className = "delete-node";
  remove.type = "button";
  remove.title = "\u5220\u9664\u8fd9\u4e2a\u8282\u70b9";
  remove.setAttribute("aria-label", "\u5220\u9664\u8fd9\u4e2a\u8282\u70b9");
  remove.innerHTML = "&times;";
  remove.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
  });
  remove.addEventListener("click", (event) => {
    event.stopPropagation();
    deleteNode(node.id);
  });

  header.append(title, remove);
  element.appendChild(header);

  const body = document.createElement("div");
  body.className = "node-body";

  if (node.type === "image") {
    const image = document.createElement("img");
    image.src = node.src;
    image.alt = node.title || text.imageAlt;
    image.draggable = false;
    image.addEventListener("load", () => {
      if (node.naturalWidth || !image.naturalWidth || !image.naturalHeight) return;
      node.naturalWidth = image.naturalWidth;
      node.naturalHeight = image.naturalHeight;
      scheduleSave();
    });
    image.addEventListener("error", () => {
      body.classList.add("image-error");
      body.textContent = text.imageError;
    });
    body.appendChild(image);
  } else if (node.type === "video") {
    const video = document.createElement("video");
    video.src = node.src;
    video.controls = true;
    video.preload = "metadata";
    video.addEventListener("loadedmetadata", () => {
      if (node.naturalWidth || !video.videoWidth || !video.videoHeight) return;
      node.naturalWidth = video.videoWidth;
      node.naturalHeight = video.videoHeight;
      scheduleSave();
    });
    video.addEventListener("error", () => {
      body.classList.add("image-error");
      body.textContent = text.videoError;
    });
    body.appendChild(video);
  } else {
    const textarea = document.createElement("textarea");
    textarea.value = node.text || "";
    textarea.placeholder = node.type === "note" ? text.notePlaceholder : text.taskPlaceholder;
    let textBeforeEdit = null;
    textarea.addEventListener("focus", () => {
      textBeforeEdit = cloneCanvasContent();
    });
    textarea.addEventListener("input", () =>
      updateNode(node.id, { text: textarea.value }, { history: false }),
    );
    textarea.addEventListener("blur", () => {
      if (!textBeforeEdit) return;
      pushHistorySnapshot(textBeforeEdit);
      textBeforeEdit = null;
    });
    body.appendChild(textarea);
  }

  element.appendChild(body);

  if (node.type === "image" || node.type === "video") {
    body.style.width = `${nodeSize.width}px`;
    body.style.height = `${nodeSize.height}px`;
    for (const corner of ["nw", "ne", "sw", "se"]) {
      const handle = document.createElement("span");
      handle.className = `resize-handle ${corner}`;
      handle.dataset.corner = corner;
      handle.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        event.stopPropagation();
        hideContextMenu();
        setSingleSelection(node.id);
        element.setPointerCapture(event.pointerId);
        const start = screenToWorld(event.clientX, event.clientY);
        drag = {
          type: "resize",
          before: cloneCanvasContent(),
          id: node.id,
          corner,
          startX: start.x,
          startY: start.y,
          nodeX: node.x,
          nodeY: node.y,
          width: nodeSize.width,
          height: nodeSize.height,
          ratio: nodeSize.width / nodeSize.height,
          element,
          body,
          dirty: false,
        };
        element.classList.add("resizing", "show-resize");
        refreshNodeClasses();
      });
      element.appendChild(handle);
    }

    element.addEventListener("pointermove", (event) => {
      if (drag) return;
      const rect = element.getBoundingClientRect();
      const near = 22;
      const nearLeft = event.clientX - rect.left <= near;
      const nearRight = rect.right - event.clientX <= near;
      const nearTop = event.clientY - rect.top <= near;
      const nearBottom = rect.bottom - event.clientY <= near;
      element.classList.toggle(
        "show-resize",
        (nearLeft || nearRight) && (nearTop || nearBottom),
      );
    });

    element.addEventListener("pointerleave", () => {
      if (!drag || drag.id !== node.id) element.classList.remove("show-resize");
    });
  }

  element.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!selectedIds.has(node.id)) setMultiSelection(getNodeSelectionScope(node.id));
    showContextMenu(event.clientX, event.clientY, node.id);
  });

  element.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    hideContextMenu();

    if (spacePan) {
      beginPan(event);
      return;
    }

    let activeNode = node;
    let activeElement = element;
    const selectionScope = getNodeSelectionScope(node.id);
    if (event.ctrlKey || event.metaKey) {
      toggleSelectionScope(selectionScope);
      return;
    }
    if (!selectedIds.has(node.id) || event.altKey || altCopyMode) setMultiSelection(selectionScope);
    else {
      selectedId = node.id;
      selectedLinkId = null;
      refreshNodeClasses();
      refreshLinkClasses();
    }

    const isEditingTitle =
      event.target.classList.contains("node-title") && event.target.readOnly === false;
    if (
      event.target.matches("textarea, button") ||
      isEditingTitle
    ) {
      refreshNodeClasses();
      return;
    }

    const before = cloneCanvasContent();
    let historyCommitted = false;
    if (event.altKey || altCopyMode) {
      pushHistorySnapshot(before);
      historyCommitted = true;
      activeNode = createNodeCopy(node, 0);
      state.nodes.push(activeNode);
      setSingleSelection(activeNode.id);
      render();
      activeElement = canvas.querySelector(`[data-id="${activeNode.id}"]`) || element;
      scheduleSave();
    }

    activeElement.setPointerCapture(event.pointerId);
    const start = screenToWorld(event.clientX, event.clientY);
    const groupIds = !historyCommitted && selectedIds.has(activeNode.id) ? [...selectedIds] : [activeNode.id];
    const group = groupIds
      .map((id) => {
        const groupNode = state.nodes.find((item) => item.id === id);
        const groupElement = canvas.querySelector(`[data-id="${id}"]`);
        return groupNode && groupElement
          ? { id, nodeX: groupNode.x, nodeY: groupNode.y, element: groupElement }
          : null;
      })
      .filter(Boolean);
    drag = {
      type: "node",
      before,
      historyCommitted,
      id: activeNode.id,
      group,
      startX: start.x,
      startY: start.y,
      nodeX: activeNode.x,
      nodeY: activeNode.y,
      element: activeElement,
      dirty: false,
    };
    viewport.classList.add("dragging");
    refreshNodeClasses();
  });

  return element;
}

function addMenuButton(label, onClick, className = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `context-menu-item ${className}`.trim();
  button.textContent = label;
  button.addEventListener("click", onClick);
  contextMenu.appendChild(button);
}

function showContextMenu(clientX, clientY, id) {
  const node = state.nodes.find((item) => item.id === id);
  contextMenu.innerHTML = "";
  addMenuButton("\u590d\u5236\u8282\u70b9", () => duplicateNode(id));
  if (node?.type === "image" || node?.type === "video") {
    addMenuButton(text.resetRatio, () => resetMediaRatio(id));
    addMenuButton(node.fit === "cover" ? text.fitContain : text.fitCover, () =>
      toggleMediaFit(id),
    );
  }
  addMenuButton("\u5220\u9664\u8282\u70b9", () => deleteNode(id), "danger");

  const colorWrap = document.createElement("div");
  colorWrap.className = "context-color-row";
  const colors = ["slate", "green", "blue", "amber", "red"];
  for (const color of colors) {
    const swatch = document.createElement("button");
    swatch.type = "button";
    swatch.className = "color-swatch";
    swatch.dataset.color = color;
    swatch.title = color;
    swatch.addEventListener("click", () => {
      setNodeColor(id, color);
      hideContextMenu();
    });
    colorWrap.appendChild(swatch);
  }
  contextMenu.appendChild(colorWrap);

  contextMenu.hidden = false;
  const rect = contextMenu.getBoundingClientRect();
  const x = Math.min(clientX, window.innerWidth - rect.width - 8);
  const y = Math.min(clientY, window.innerHeight - rect.height - 8);
  contextMenu.style.left = `${Math.max(8, x)}px`;
  contextMenu.style.top = `${Math.max(8, y)}px`;
}

function render() {
  renderGroups();
  canvas.innerHTML = "";
  for (const node of state.nodes) {
    canvas.appendChild(renderNode(node));
  }
  renderLinks();
}

function load() {
  const saved = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(OLD_STORAGE_KEY);
  if (saved) {
    try {
      state = JSON.parse(saved);
      state.groups = Array.isArray(state.groups) ? state.groups : [];
      state.nodes = state.nodes.map((node) => ({
        color: node.type === "note" ? "amber" : "slate",
        ...node,
      }));
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(OLD_STORAGE_KEY);
    }
  }

  if (!state.nodes.length) {
    state.groups = [];
    state.nodes = [
      {
        id: "node-start",
        type: "task",
        color: "green",
        x: 0,
        y: 0,
        title: text.start,
        text: text.startBody,
      },
      {
        id: "node-note",
        type: "note",
        color: "amber",
        x: 310,
        y: 24,
        title: text.note,
        text: text.noteBodyInitial,
      },
    ];
    state.links = [{ id: "link-start-note", from: "node-start", to: "node-note" }];
  }
  applyView();
  render();
}

function focusNode(node) {
  const size = getNodeSize(node);
  const rect = viewport.getBoundingClientRect();
  state.view.x = rect.width / 2 - (node.x + size.width / 2) * state.view.scale;
  state.view.y = rect.height / 2 - (node.y + size.height / 2) * state.view.scale;
  setSingleSelection(node.id);
  applyView();
  render();
}

function searchNode() {
  const query = searchInput.value.trim().toLowerCase();
  if (!query) return;
  const node = state.nodes.find((item) => {
    const haystack = `${item.title || ""} ${item.text || ""}`.toLowerCase();
    return haystack.includes(query);
  });
  if (!node) {
    window.alert(text.noSearch);
    return;
  }
  focusNode(node);
}

document.getElementById("addTask").addEventListener("click", () => {
  resetMode();
  createNode("task");
});
document.getElementById("addNote").addEventListener("click", () => {
  resetMode();
  createNode("note");
});
document.getElementById("addImage").addEventListener("click", () => {
  resetMode();
  imageInput.click();
});
document.getElementById("addVideo").addEventListener("click", () => {
  resetMode();
  videoInput.click();
});
aiSettingsButton.addEventListener("click", openAiModal);
closeAiModalButton.addEventListener("click", closeAiModal);
skipAiSettingsButton.addEventListener("click", closeAiModal);
aiModal.addEventListener("click", (event) => {
  if (event.target === aiModal) closeAiModal();
});
saveAiSettingsButton.addEventListener("click", () => {
  saveAiSettings();
  closeAiModal();
});
testAiSettingsButton.addEventListener("click", async () => {
  const settings = saveAiSettings();
  if (!settings.apiKey) {
    window.alert("请先填写 API Key。");
    return;
  }
  testAiSettingsButton.disabled = true;
  try {
    const result = await callAi(settings, "请回复：接口连接成功");
    window.alert(result);
  } catch (error) {
    window.alert(error.message || "接口测试失败。");
  } finally {
  testAiSettingsButton.disabled = false;
  }
});
aiTextGenerateButton.addEventListener("click", generateWithAi);
aiImageGenerateButton.addEventListener("click", generateImagesWithAi);
aiGenerateButton.addEventListener("click", openAiModal);
if (undoActionButton) {
  undoActionButton.addEventListener("click", () => {
    resetMode();
    undoLastChange();
  });
}
if (createGroupButton) {
  createGroupButton.addEventListener("click", () => {
    resetMode();
    createGroupFromSelection();
  });
}
if (ungroupSelectedButton) {
  ungroupSelectedButton.addEventListener("click", () => {
    resetMode();
    ungroupSelected();
  });
}
deleteSelectedButton.addEventListener("click", () => {
  resetMode();
  deleteSelectedNode();
});
document.getElementById("searchButton").addEventListener("click", searchNode);
searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") searchNode();
});

document.getElementById("fitView").addEventListener("click", () => {
  resetMode();
  state.view = { x: 420, y: 220, scale: 1 };
  applyView();
});

document.getElementById("clearCanvas").addEventListener("click", () => {
  const ok = window.confirm(text.clearConfirm);
  if (!ok) return;
  commitHistory();
  state.nodes = [];
  state.links = [];
  state.groups = [];
  clearSelection();
  hideContextMenu();
  render();
  scheduleSave();
});

imageInput.addEventListener("change", () => {
  const file = imageInput.files?.[0];
  if (!file) return;
  const center = screenToWorld(window.innerWidth / 2, window.innerHeight / 2);
  addImageFile(file, center);
  imageInput.value = "";
});

videoInput.addEventListener("change", () => {
  const file = videoInput.files?.[0];
  if (!file) return;
  const center = screenToWorld(window.innerWidth / 2, window.innerHeight / 2);
  addVideoFile(file, center);
  videoInput.value = "";
});

document.getElementById("exportJson").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "workflow-canvas.json";
  anchor.click();
  URL.revokeObjectURL(url);
});

document.getElementById("importJson").addEventListener("click", () => jsonInput.click());
jsonInput.addEventListener("change", () => {
  const file = jsonInput.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!Array.isArray(imported.nodes) || !Array.isArray(imported.links)) {
        throw new Error("Invalid canvas file");
      }
      imported.groups = Array.isArray(imported.groups) ? imported.groups : [];
      commitHistory();
      state = imported;
      clearSelection();
      applyView();
      render();
      scheduleSave();
    } catch {
      window.alert(text.invalidJson);
    }
  };
  reader.readAsText(file);
  jsonInput.value = "";
});

window.addEventListener(
  "pointerdown",
  (event) => {
    if (!spacePan || event.button !== 0) return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target || !viewport.contains(target)) return;
    event.preventDefault();
    event.stopPropagation();
    hideContextMenu();
    beginPan(event);
  },
  true,
);

viewport.addEventListener("pointerdown", (event) => {
  if (event.button !== 0 || event.target !== viewport) return;
  hideContextMenu();
  beginMarqueeSelect(event);
});

viewport.addEventListener("contextmenu", (event) => {
  event.preventDefault();
  hideContextMenu();
});

window.addEventListener("pointermove", (event) => {
  if (!drag) return;

  if (drag.type === "pan") {
    state.view.x = drag.viewX + event.clientX - drag.startX;
    state.view.y = drag.viewY + event.clientY - drag.startY;
    drag.dirty = true;
    applyView();
    return;
  }

  if (drag.type === "node") {
    const point = screenToWorld(event.clientX, event.clientY);
    const dx = point.x - drag.startX;
    const dy = point.y - drag.startY;
    const group = drag.group?.length ? drag.group : [drag];
    for (const item of group) {
      const node = state.nodes.find((candidate) => candidate.id === item.id);
      if (!node) continue;
      node.x = item.nodeX + dx;
      node.y = item.nodeY + dy;
      item.element.style.transform = `translate(${node.x}px, ${node.y}px)`;
    }
    drag.dirty = true;
    renderLinks();
  }

  if (drag.type === "group") {
    const point = screenToWorld(event.clientX, event.clientY);
    const dx = point.x - drag.startX;
    const dy = point.y - drag.startY;
    const group = state.groups?.find((item) => item.id === drag.id);
    if (!group) return;
    group.x = drag.groupX + dx;
    group.y = drag.groupY + dy;
    drag.element.style.transform = `translate(${group.x}px, ${group.y}px)`;
    for (const item of drag.nodePositions) {
      const node = state.nodes.find((candidate) => candidate.id === item.id);
      if (!node) continue;
      node.x = item.nodeX + dx;
      node.y = item.nodeY + dy;
      item.element.style.transform = `translate(${node.x}px, ${node.y}px)`;
    }
    drag.dirty = true;
    renderLinks();
  }

  if (drag.type === "select") {
    const rect = viewport.getBoundingClientRect();
    drag.screenCurrent = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    drag.worldCurrent = screenToWorld(event.clientX, event.clientY);
    drag.dirty =
      Math.abs(drag.screenCurrent.x - drag.screenStart.x) > 4 ||
      Math.abs(drag.screenCurrent.y - drag.screenStart.y) > 4;
    updateSelectionBox(drag.screenStart, drag.screenCurrent);
    const selectRect = {
      left: Math.min(drag.worldStart.x, drag.worldCurrent.x),
      right: Math.max(drag.worldStart.x, drag.worldCurrent.x),
      top: Math.min(drag.worldStart.y, drag.worldCurrent.y),
      bottom: Math.max(drag.worldStart.y, drag.worldCurrent.y),
    };
    const ids = drag.dirty
      ? state.nodes.filter((node) => nodeIntersectsRect(node, selectRect)).map((node) => node.id)
      : [];
    setMultiSelection(ids);
  }

  if (drag.type === "resize") {
    const node = state.nodes.find((item) => item.id === drag.id);
    if (!node) return;

    const point = screenToWorld(event.clientX, event.clientY);
    const dx = point.x - drag.startX;
    const dy = point.y - drag.startY;
    const minWidth = 120;
    const minHeight = 90;

    let nextX = drag.nodeX;
    let nextY = drag.nodeY;
    let nextWidth = drag.width;
    let nextHeight = drag.height;

    if (event.shiftKey) {
      if (drag.corner.includes("e")) nextWidth = drag.width + dx;
      if (drag.corner.includes("s")) nextHeight = drag.height + dy;
      if (drag.corner.includes("w")) {
        nextWidth = drag.width - dx;
        nextX = drag.nodeX + dx;
      }
      if (drag.corner.includes("n")) {
        nextHeight = drag.height - dy;
        nextY = drag.nodeY + dy;
      }
    } else {
      const widthCandidate = drag.corner.includes("w") ? drag.width - dx : drag.width + dx;
      const heightCandidate = drag.corner.includes("n") ? drag.height - dy : drag.height + dy;
      const scaleFromWidth = widthCandidate / drag.width;
      const scaleFromHeight = heightCandidate / drag.height;
      const scale =
        Math.abs(scaleFromWidth - 1) > Math.abs(scaleFromHeight - 1)
          ? scaleFromWidth
          : scaleFromHeight;
      nextWidth = drag.width * scale;
      nextHeight = nextWidth / drag.ratio;
      if (drag.corner.includes("w")) nextX = drag.nodeX + (drag.width - nextWidth);
      if (drag.corner.includes("n")) nextY = drag.nodeY + (drag.height - nextHeight);
    }

    if (nextWidth < minWidth) {
      if (drag.corner.includes("w")) nextX -= minWidth - nextWidth;
      nextWidth = minWidth;
    }
    if (nextHeight < minHeight) {
      if (drag.corner.includes("n")) nextY -= minHeight - nextHeight;
      nextHeight = minHeight;
    }

    node.x = nextX;
    node.y = nextY;
    node.width = nextWidth;
    node.height = nextHeight;
    drag.element.style.width = `${nextWidth}px`;
    drag.element.style.transform = `translate(${nextX}px, ${nextY}px)`;
    drag.body.style.width = `${nextWidth}px`;
    drag.body.style.height = `${nextHeight}px`;
    drag.dirty = true;
    renderLinks();
  }

  if (drag.type === "connect") {
    drag.toPoint = screenToWorld(event.clientX, event.clientY);
    renderLinks();
  }
});

window.addEventListener("pointerup", (event) => {
  if (!drag) return;
  if (drag.type === "select") {
    const wasDirty = drag.dirty;
    drag = null;
    viewport.classList.remove("selecting");
    selectionBox.hidden = true;
    if (!wasDirty) clearSelection();
    return;
  }
  if (drag.type === "connect") {
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest(".connection-port");
    if (target && target.dataset.nodeId && target.dataset.nodeId !== drag.fromId) {
      const existing = state.links.find(
        (link) =>
          link.from === drag.fromId &&
          link.to === target.dataset.nodeId &&
          link.fromPort === drag.fromPort &&
          link.toPort === target.dataset.port,
      );
      if (existing) {
        selectedLinkId = existing.id;
      } else {
        pushHistorySnapshot(drag.before);
        const newLink = {
          id: uid("link"),
          from: drag.fromId,
          to: target.dataset.nodeId,
          fromPort: drag.fromPort,
          toPort: target.dataset.port,
        };
        state.links.push({
          ...newLink,
        });
        selectedLinkId = newLink.id;
      }
      saveNow();
    }
    drag = null;
    viewport.classList.remove("connecting-drag");
    render();
    return;
  }
  const shouldSave = drag.dirty;
  const element = drag.element;
  const before = drag.before;
  const historyCommitted = drag.historyCommitted;
  drag = null;
  viewport.classList.remove("dragging");
  if (element) element.classList.remove("resizing", "show-resize");
  if (shouldSave) {
    if (!historyCommitted && before) pushHistorySnapshot(before);
    saveNow();
  }
});

window.addEventListener("pointercancel", () => {
  if (!drag) return;
  if (drag.type === "select") {
    drag = null;
    viewport.classList.remove("selecting");
    selectionBox.hidden = true;
    clearSelection();
    return;
  }
  if (drag.type === "connect") {
    drag = null;
    viewport.classList.remove("connecting-drag");
    renderLinks();
    return;
  }
  const shouldSave = drag.dirty;
  const element = drag.element;
  const before = drag.before;
  const historyCommitted = drag.historyCommitted;
  drag = null;
  viewport.classList.remove("dragging");
  if (element) element.classList.remove("resizing", "show-resize");
  if (shouldSave) {
    if (!historyCommitted && before) pushHistorySnapshot(before);
    saveNow();
  }
});

viewport.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();
    hideContextMenu();
    const before = screenToWorld(event.clientX, event.clientY);
    const factor = event.deltaY < 0 ? 1.08 : 0.92;
    state.view.scale = Math.min(2.4, Math.max(0.22, state.view.scale * factor));
    const rect = viewport.getBoundingClientRect();
    state.view.x = event.clientX - rect.left - before.x * state.view.scale;
    state.view.y = event.clientY - rect.top - before.y * state.view.scale;
    applyView();
  },
  { passive: false },
);

function hasMediaFiles(dataTransfer) {
  return Array.from(dataTransfer?.items || dataTransfer?.files || []).some((item) => {
    const type = item.type || "";
    return type.startsWith("image/") || type.startsWith("video/");
  });
}

viewport.addEventListener("dragenter", (event) => {
  if (!hasMediaFiles(event.dataTransfer)) return;
  event.preventDefault();
  dragOverDepth += 1;
  viewport.classList.add("drop-ready");
});

viewport.addEventListener("dragover", (event) => {
  if (!hasMediaFiles(event.dataTransfer)) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "copy";
});

viewport.addEventListener("dragleave", () => {
  dragOverDepth = Math.max(0, dragOverDepth - 1);
  if (dragOverDepth === 0) viewport.classList.remove("drop-ready");
});

viewport.addEventListener("drop", (event) => {
  if (!hasMediaFiles(event.dataTransfer)) return;
  event.preventDefault();
  dragOverDepth = 0;
  viewport.classList.remove("drop-ready");

  const files = Array.from(event.dataTransfer.files).filter((file) =>
    file.type.startsWith("image/") || file.type.startsWith("video/"),
  );
  files.forEach((file, index) => {
    const point = screenToWorld(event.clientX + index * 26, event.clientY + index * 26);
    if (file.type.startsWith("video/")) addVideoFile(file, point);
    else addImageFile(file, point);
  });
});

window.addEventListener("paste", (event) => {
  if (isTextEditingElement(document.activeElement)) return;
  const items = Array.from(event.clipboardData?.items || []);
  const imageItems = items.filter((item) => item.type.startsWith("image/"));
  const textValue = event.clipboardData?.getData("text/plain");
  const center = screenToWorld(window.innerWidth / 2, window.innerHeight / 2);

  if (imageItems.length) {
    event.preventDefault();
    imageItems.forEach((item, index) => {
      const file = item.getAsFile();
      if (!file) return;
      const point = {
        x: center.x + index * 28,
        y: center.y + index * 28,
      };
      const namedFile = new File(
        [file],
        file.name || `clipboard-image-${Date.now()}-${index + 1}.png`,
        { type: file.type || "image/png" },
      );
      addImageFile(namedFile, point);
    });
    return;
  }

  if (textValue?.trim()) {
    event.preventDefault();
    addTextNote(textValue, center);
  }
});

window.addEventListener("keydown", (event) => {
  const active = document.activeElement;
  const isTyping = isTextEditingElement(active);
  if (event.key === "Alt") {
    altCopyMode = true;
  }
  if (isUndoShortcut(event) && !isTyping) {
    event.preventDefault();
    event.stopPropagation();
    undoLastChange();
    return;
  }
  if (event.code === "Space" && !isTyping) {
    event.preventDefault();
    setSpacePan(true);
    return;
  }
  if (event.key === "Escape") {
    resetMode();
    hideContextMenu();
    setSpacePan(false);
    return;
  }
  if ((event.key === "Delete" || event.key === "Backspace") && (selectedId || selectedIds.size)) {
    const active = document.activeElement;
    if (isTextEditingElement(active)) return;
    event.preventDefault();
    deleteSelectedNode();
  }
  if ((event.key === "Delete" || event.key === "Backspace") && selectedLinkId) {
    const active = document.activeElement;
    if (isTextEditingElement(active)) return;
    event.preventDefault();
    deleteLink(selectedLinkId);
  }
}, true);

window.addEventListener("keyup", (event) => {
  if (event.key === "Alt") {
    altCopyMode = false;
  }
  if (event.code === "Space") {
    event.preventDefault();
    setSpacePan(false);
  }
});

window.addEventListener("blur", () => {
  altCopyMode = false;
  setSpacePan(false);
});

window.addEventListener("resize", () => {
  hideContextMenu();
});

load();
