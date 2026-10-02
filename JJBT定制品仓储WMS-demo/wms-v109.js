"use strict";

/* 已保存的规则 V1.09。这一份不再随后面的演示改。五个模块：看板、入库、出库、库存、追溯。 */

const NAV = [
  ["看板", [["kanban", "今天进度"], ["sim", "模拟作业"]]],
  ["入库", [["post", "小邮局"], ["receive", "收货"], ["transfer", "调拨"], ["gather", "集货合单"], ["qc", "质检"], ["assemble", "组装加工"], ["putaway", "上架"], ["move", "移库（框架）"], ["special", "特殊入库（框架）"], ["returns", "退货（框架）"]]],
  ["出库", [["wave", "波次和72小时"], ["pick", "拣货"], ["rebin", "二次分拣"], ["one", "单件复核"], ["many", "多件复核"], ["weigh", "称重出库"], ["load", "装载交接"], ["waybill", "面单"], ["factory", "淮安复核"]]],
  ["库存", [["stock", "库位和占用"], ["slots", "订单库位"], ["check", "库位核对"]]],
  ["追溯", [["trace", "按件或按单查"], ["logs", "作业日志"], ["hours", "工时考勤（框架）"], ["accounts", "账号权限（框架）"]]],
];

const H72 = 72 * 3600 * 1000;
const POSTS = {
  receive: ["收货员"],
  qc: ["质检员"],
  scrap: ["质检员"],
  putaway: ["上架员"],
  waveRun: ["拣货员"],
  split: ["异常订单处理专员"],
  pick: ["拣货员"],
  pack: ["打包员"],
  weigh: ["发货员"],
  shortFix: ["异常订单处理专员"],
  transfer: ["调拨员"],
  transferOk: ["仓库主管"],
  assemble: ["组装员"],
  waybill: ["拣货员"],
  check: ["仓库主管"],
  post: ["收货员"],
  rebin: ["拣货员"],
  factory: ["打包员"],
  handover: ["发货员"],
  frame: ["仓库主管"],
  cutoff: ["仓库主管"],
};

const JOB = {
  kanban: { who: "仓库主管、仓库管理员看", rule: "看今天仓里走到哪一步。数字按件计，和后面各屏的单据是同一批货。", next: "点数字对单据。要亲手走一遍，打开这一组里的「模拟作业」。" },
  sim: { who: "培训时由仓库管理员带着各岗位点", rule: "现成的模拟单上有：质检通过直到称重；质检不通过进废品库位；货在别的仓先调拨；订单带了礼盒先组装再上架。点预设的定制品 ID 就当作扫到了。", next: "每一步做完，看屏幕上状态变成什么，再去下一屏。正式仓没有这一页上的拨时钟。" },
  post: { who: "收货员动手", rule: "入库第一个工序。扫工厂发给仓库的集货快递单号，对上到货单，按箱里每个定制品 ID 清点件数，和供应商发货清单核对。", next: "对得上才去收货。对不上只记差异，不能写成已收货。截单前到的箱，当天要收完。" },
  receive: { who: "收货员动手", rule: "小邮局清点之后，在集货仓扫定制品 ID。扫一次只收一件，并核对母订单、子订单应有的件数。货还在别的仓、或正在调拨途中，不能在这里收成已收货。", next: "做完交给质检员。状态变成「已收货待质检」。先放待质检区，不占订单仓，不启动 72 小时。" },
  qc: { who: "质检员动手", rule: "再扫同一定制品 ID。通过和不通过都要先拍照。没带增值服务的，通过后放进这张母订单的上架盆。带了增值服务的，通过后先去组装，不进盆。不通过由质检员扫上本仓废品库位。", next: "没带增值服务的交给上架员，状态是「质检通过待上架」。带了增值服务的交给组装员，状态是「待组装」。时钟都还没开始。不通过变成「已上废品库位」，不进波次。" },
  putaway: { who: "上架员动手", rule: "四步都要扫完才算在库：上架盆、库位、盆里每一个定制品 ID、回扫空盆。少一步都不算占用。", next: "做完这一件是「已上架」。这张母订单第一件占用库位时，72 小时从这一下起算。凑齐后系统自己建波次，交给拣货员去打面单。" },
  wave: { who: "系统先建工单；拣货员在这台电脑打面单；拆单只有异常订单处理专员能做", rule: "凑齐后按件数分成单件波次或多件波次。超过 72 小时，只把已经在库的件拆出来发。", next: "面单打印成功后，这些件变成「已入波次」，交给拣货员按面单去拣。没选物流渠道不能打印。" },
  pick: { who: "拣货员动手", rule: "先扫面单找到母订单，再按面单逐件扫定制品 ID。一件和多件都在这一屏拣完。不能扫一次运单号就把一件拣完。", next: "这一库位上该拣的都扫完，库位释放。一件去单件复核，多件去多件复核。" },
  one: { who: "打包员动手", rule: "一单一件走这一套。先扫运单号，再核这一个定制品 ID。打面单当时不写成已向客户发货。", next: "齐了先封箱，再扫一次面单。状态变成已打包、待称重。" },
  many: { who: "打包员动手", rule: "一单多件走这一套。同款多件和多款多件都在这里，不再拆第三套。按每一个定制品 ID 复核。", next: "齐了先封箱，再扫一次面单。少件、多件要停给异常订单处理专员。这一下还不是已向客户发货。" },
  pack: { who: "打包员动手", rule: "按件数打开单件复核或多件复核。", next: "齐了先封箱，再扫一次面单。" },
  rebin: { who: "拣货员动手", rule: "单独一屏。需要把同一张母订单、同一张面单上的多件再归到一处时才用。不经过这里，多件复核也能打开。", next: "汇齐与否都不挡住多件复核。不能按收件人把两张母订单合成一张面单。" },
  weigh: { who: "发货员动手", rule: "扫面单，再读取出库秤。重量只记录。重量和预估不一样，也不拦住已向客户发货的回写。不能手填一个重量。", next: "称重成功后状态变成已出库称重，并回写已向客户发货。下一步是装载交接，不移入笼车。" },
  load: { who: "发货员动手", rule: "只交接已经称重成功的包裹。系统打出当日交接清单。", next: "清单上是当天已称重并且已交接的运单。没称重的不进清单。不扫描笼车。" },
  factory: { who: "淮安的打包员动手", rule: "一件和多件都可以在淮安复核后直发，不进杭州质检和上架。只有超尺寸、物流渠道到不了、地址或国家有问题，才转到杭州。到了杭州仍要质检、上架。", next: "直发的去称重。转杭州的去调拨。72 小时不从淮安起算。" },
  move: { who: "本期只做框架，仓库主管可以打开", rule: "能看出移库以后记在哪。这一页不改货的状态，也不跳过收货、质检、上架。", next: "不作为从收货到称重的验收。" },
  special: { who: "本期只做框架，仓库主管可以打开", rule: "错发、盘盈一类先记一笔送审。通过后也不能变成谁都能拿走的库存。", next: "主路径的工厂到货不在这里建单。" },
  returns: { who: "本期只做框架，仓库主管可以打开", rule: "退货先记一笔。不能把废品改判成合格，也不能改成可卖库存。", next: "不代替质检和上架。" },
  hours: { who: "本期只做框架，仓库主管可以打开", rule: "按岗位看今天点过哪些步骤。这里不算工资。", next: "只看框架。" },
  accounts: { who: "本期只做框架，仓库主管可以打开", rule: "看每个岗位能打开哪一屏。演练时仓库管理员可以代点，记录里仍写岗位。", next: "不在这一页改货。" },
  stock: { who: "仓库主管核对", rule: "按仓库看每一件在待质检、待加工、订单库位、废品库位，还是在调拨途中。", next: "这里没有「合格且任意订单都能拿走」的可卖数量。调拨在途两个仓都不算在库。不能把一件改派给另一张母订单。" },
  trace: { who: "仓库主管、平台事后查", rule: "用定制品 ID 或母订单号，看这一件经过收货、调拨、质检、组装、库位、波次、拣货、复核、称重。不通过和废品库位也在里面。", next: "只查，不在这里改状态。夜间上传只是留档。" },
  transfer: { who: "主管确认开单，调拨员在两个仓扫码", rule: "货不在集货仓时，用调拨单调到集货仓。调出仓不做质检、不上架。", next: "调入完成才变成集货仓的已收货待质检。调拨单不能拿去给顾客打面单。在途时两个仓都不算在库。" },
  gather: { who: "收货员核对，系统自动合单", rule: "集货仓按母订单等齐。同一张母订单分几次到的件，合成这一张单的清单。", next: "应收件数不因为调拨再加一次。两张母订单不能并成一个顾客包裹。72 小时只在集货仓上架成功后才开始。" },
  assemble: { who: "组装员动手", rule: "只在集货仓。质检已通过、订单带了增值服务、还没进上架盆。逐件扫定制品 ID，做完才能进盆。", next: "组装完成才交给上架员。这一步不算在库，也不启动 72 小时。没带增值服务的单不出现在这里。" },
  slots: { who: "仓库主管看", rule: "一个订单库位同一时间只挂一张母订单。格子里还没有的件标成还缺，不能拿同款别的货来顶。", next: "只看。收货、上架、拣货仍去原来的岗位屏。空出来的格子才能给下一张母订单。" },
  check: { who: "仓库主管动手", rule: "对一下这个格子里看到的定制品 ID，是不是账面这一张母订单的这一件。", next: "对得上或对不上都只记一笔。不改货的状态，不审批，也不出现谁都能拿走的数量。" },
  logs: { who: "仓库主管事后查", rule: "按时间看谁做了收货、调拨、质检、组装、上架、拣货、复核、称重、核对、换面单。", next: "只查，不在这里改状态。" },
  waybill: { who: "拣货员动手", rule: "面单已经打出、还没称重时，可以按原号再打一张，或请订单中台重取一个新号。货品标签只印已有的定制品 ID。", next: "旧号停止后，拣货、复核、称重都扫新号。这一步不写成已向客户发货。仓库不改收件地址。已经称重的不能在这里换号。" },
};

function esc(s) { return String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
function now() { return new Date().toLocaleString("zh-CN", { hour12: false }); }
function badge(text, kind) { return `<span class="badge ${kind || ""}">${esc(text)}</span>`; }
function btn(label, act, data, primary) {
  const attrs = Object.entries(data || {}).map(([k, v]) => ` data-${k}="${esc(v)}"`).join("");
  return `<button type="button" class="btn${primary ? " primary" : ""}" data-act="${esc(act)}"${attrs}>${esc(label)}</button>`;
}
function pageHead(title, sub) { return `<h1>${esc(title)}</h1><p class="sub">${esc(sub)}</p>`; }
function table(headers, rows) {
  const body = rows.length
    ? rows.map(r => `<tr class="${r._cls || ""}">${r.cells.map(c => `<td>${c}</td>`).join("")}</tr>`).join("")
    : `<tr><td colspan="${headers.length}">这一屏当前没有要处理的记录。</td></tr>`;
  return `<div class="tw"><table><thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table></div>`;
}
function row(cells, cls) { return { cells, _cls: cls || "" }; }

function piece(partial) {
  return Object.assign({
    id: "", motherId: "", subId: "", sku: "", name: "", highValue: false, spec: "",
    stage: "待收货", warehouse: "杭州仓", via: "本仓收货", bin: "", slot: "", scrapSlot: "", scrapTarget: "",
    putawayAt: null, waveId: "", reviewed: false, orderSide: "",
    qc: null, events: [],
  }, partial);
}
function mother(partial) {
  return Object.assign({
    id: "", shape: "", hub: "杭州仓", vas: "", clockStart: null, holidayPauseMs: 0, locationId: "",
    recvLock: false, subs: [],
  }, partial);
}
function addEvent(p, who, step, text) {
  p.events.unshift({ t: now(), who, role: S.role, step, text, status: p.stage });
  S.logs.unshift({ t: now(), who, step, text, id: p.id, motherId: p.motherId });
}

function seed() {
  const t0 = Date.now();
  const mothers = [
    mother({ id: "MO-10086", shape: "多款多件", subs: [
      { id: "SO-1", sku: "红色定制杯", name: "红色定制杯", qty: 1 },
      { id: "SO-2", sku: "木质相框", name: "木质相框", qty: 1 },
    ] }),
    mother({ id: "MO-10090", shape: "同款多件", subs: [
      { id: "SO-90", sku: "蓝色定制杯", name: "蓝色定制杯", qty: 2 },
    ] }),
    mother({ id: "MO-10099", shape: "一单一件", subs: [
      { id: "SO-99", sku: "定制马克杯", name: "定制马克杯", qty: 1 },
    ] }),
    mother({ id: "MO-101", shape: "一单一件", subs: [{ id: "SO-101", sku: "高价值项链", name: "高价值项链", qty: 1 }] }),
    mother({ id: "MO-102", shape: "一单一件", locationId: "OC-02", subs: [{ id: "SO-102", sku: "定制抱枕", name: "定制抱枕", qty: 1 }] }),
    mother({ id: "MO-201", shape: "多款多件", clockStart: t0 - 10 * 3600 * 1000, locationId: "OC-03", subs: [
      { id: "SO-201A", sku: "定制杯", name: "定制杯", qty: 1 },
      { id: "SO-201B", sku: "定制盘", name: "定制盘", qty: 1 },
    ] }),
    mother({ id: "MO-301", shape: "多款多件", clockStart: t0 - 6 * 3600 * 1000, locationId: "OC-04", subs: [
      { id: "SO-301A", sku: "定制杯", name: "定制杯", qty: 1 },
      { id: "SO-301B", sku: "定制勺", name: "定制勺", qty: 1 },
    ] }),
    mother({ id: "MO-311", shape: "一单一件", clockStart: t0 - 4 * 3600 * 1000, locationId: "OC-08", subs: [
      { id: "SO-311", sku: "定制徽章", name: "定制徽章", qty: 1 },
    ] }),
    mother({ id: "MO-401", shape: "多款多件", clockStart: t0 - 80 * 3600 * 1000, locationId: "OC-05", subs: [
      { id: "SO-401A", sku: "定制杯", name: "定制杯", qty: 1 },
      { id: "SO-401B", sku: "定制盒", name: "定制盒", qty: 1 },
    ] }),
    mother({ id: "MO-501", shape: "多款多件", clockStart: t0 - 8 * 3600 * 1000, locationId: "OC-06", subs: [
      { id: "SO-501A", sku: "定制杯", name: "定制杯", qty: 1 },
      { id: "SO-501B", sku: "定制垫", name: "定制垫", qty: 1 },
    ] }),
    mother({ id: "MO-601", shape: "一单一件", clockStart: t0 - 20 * 3600 * 1000, subs: [
      { id: "SO-601", sku: "定制杯", name: "定制杯", qty: 1 },
    ] }),
    mother({ id: "MO-701", shape: "一单一件", clockStart: t0 - 26 * 3600 * 1000, subs: [
      { id: "SO-701", sku: "定制杯", name: "定制杯", qty: 1 },
    ] }),
    mother({ id: "MO-801", shape: "一单一件", clockStart: t0 - 30 * 3600 * 1000, subs: [
      { id: "SO-801", sku: "定制杯", name: "定制杯", qty: 1 },
    ] }),
    mother({ id: "MO-901", shape: "一单一件", subs: [
      { id: "SO-901", sku: "破损杯", name: "破损杯", qty: 1 },
    ] }),
    mother({ id: "MO-10087", shape: "一单一件", hub: "杭州仓", subs: [
      { id: "SO-87", sku: "定制摆件", name: "定制摆件", qty: 1 },
    ] }),
    mother({ id: "MO-10088", shape: "一单一件", hub: "杭州仓", vas: "装进礼盒，并贴客供标", subs: [
      { id: "SO-88", sku: "定制礼盒杯", name: "定制礼盒杯", qty: 1 },
    ] }),
    mother({ id: "MO-HA01", shape: "一单一件", hub: "淮安仓", subs: [
      { id: "SO-HA1", sku: "淮安定制杯", name: "淮安定制杯", qty: 1 },
    ] }),
    mother({ id: "MO-HA02", shape: "多款多件", hub: "淮安仓", subs: [
      { id: "SO-HA2A", sku: "淮安杯", name: "淮安杯", qty: 1 },
      { id: "SO-HA2B", sku: "淮安盘", name: "淮安盘", qty: 1 },
    ] }),
    mother({ id: "MO-HA03", shape: "一单一件", hub: "杭州仓", subs: [
      { id: "SO-HA3", sku: "超大定制画", name: "超大定制画", qty: 1 },
    ] }),
  ];
  const photo = (name) => ({ name, kind: "质检照片", status: "在系统服务器" });
  const pieces = [
    piece({ id: "U-001", motherId: "MO-10086", subId: "SO-1", sku: "红色定制杯", name: "红色定制杯", spec: "杯身印红色", expect: { size: "杯高 9 厘米", color: "红色", material: "陶瓷" } }),
    piece({ id: "U-002", motherId: "MO-10086", subId: "SO-2", sku: "木质相框", name: "木质相框", spec: "相框长 18 厘米、宽 13 厘米", expect: { size: "18×13 厘米", color: "原木色", material: "木材" } }),
    piece({ id: "U-090A", motherId: "MO-10090", subId: "SO-90", sku: "蓝色定制杯", name: "蓝色定制杯", spec: "同款第 1 件", expect: { size: "杯高 9 厘米", color: "蓝色", material: "陶瓷" } }),
    piece({ id: "U-090B", motherId: "MO-10090", subId: "SO-90", sku: "蓝色定制杯", name: "蓝色定制杯", spec: "同款第 2 件", expect: { size: "杯高 9 厘米", color: "蓝色", material: "陶瓷" } }),
    piece({ id: "U-099", motherId: "MO-10099", subId: "SO-99", sku: "定制马克杯", name: "定制马克杯", spec: "杯身印名字", expect: { size: "杯高 10 厘米", color: "白色", material: "陶瓷" } }),
    piece({ id: "U-101", motherId: "MO-101", subId: "SO-101", sku: "高价值项链", name: "高价值项链", highValue: true, spec: "吊坠刻字", stage: "已收货待质检", expect: { size: "链长 45 厘米", color: "金色", material: "合金" } }),
    piece({ id: "U-102", motherId: "MO-102", subId: "SO-102", sku: "定制抱枕", name: "定制抱枕", spec: "正面印照片", stage: "质检通过待上架", bin: "BIN-102",
      qc: { result: "通过", reason: "", size: "40×40 厘米", color: "米色", material: "棉", photos: [photo("U-102-照片")], video: "", weight: "", at: "演示开始前", who: "质检员" },
      expect: { size: "40×40 厘米", color: "米色", material: "棉" } }),
    piece({ id: "U-201", motherId: "MO-201", subId: "SO-201A", sku: "定制杯", name: "定制杯", stage: "已上架", slot: "OC-03", putawayAt: t0 - 10 * 3600 * 1000,
      qc: { result: "通过", reason: "", size: "9 厘米", color: "红色", material: "陶瓷", photos: [photo("U-201-照片")], video: "", weight: "", at: "演示开始前", who: "质检员" } }),
    piece({ id: "U-202", motherId: "MO-201", subId: "SO-201B", sku: "定制盘", name: "定制盘", stage: "待收货", spec: "还没到仓", expect: { size: "20 厘米", color: "白色", material: "陶瓷" } }),
    piece({ id: "U-301", motherId: "MO-301", subId: "SO-301A", sku: "定制杯", name: "定制杯", stage: "已上架", slot: "OC-04", putawayAt: t0 - 6 * 3600 * 1000, waveId: "WV-301",
      qc: { result: "通过", reason: "", size: "9 厘米", color: "红", material: "陶瓷", photos: [photo("U-301-照片")], video: "", weight: "", at: "演示开始前", who: "质检员" } }),
    piece({ id: "U-302", motherId: "MO-301", subId: "SO-301B", sku: "定制勺", name: "定制勺", stage: "已上架", slot: "OC-04", putawayAt: t0 - 6 * 3600 * 1000, waveId: "WV-301",
      qc: { result: "通过", reason: "", size: "15 厘米", color: "银", material: "金属", photos: [photo("U-302-照片")], video: "", weight: "", at: "演示开始前", who: "质检员" } }),
    piece({ id: "U-311", motherId: "MO-311", subId: "SO-311", sku: "定制徽章", name: "定制徽章", stage: "已上架", slot: "OC-08", putawayAt: t0 - 4 * 3600 * 1000, waveId: "WV-311",
      qc: { result: "通过", reason: "", size: "3 厘米", color: "金", material: "金属", photos: [photo("U-311-照片")], video: "", weight: "", at: "演示开始前", who: "质检员" } }),
    piece({ id: "U-401", motherId: "MO-401", subId: "SO-401A", sku: "定制杯", name: "定制杯", stage: "已上架", slot: "OC-05", putawayAt: t0 - 80 * 3600 * 1000,
      qc: { result: "通过", reason: "", size: "9 厘米", color: "蓝", material: "陶瓷", photos: [photo("U-401-照片")], video: "", weight: "", at: "演示开始前", who: "质检员" } }),
    piece({ id: "U-402", motherId: "MO-401", subId: "SO-401B", sku: "定制盒", name: "定制盒", stage: "待收货", spec: "还没到仓", expect: { size: "12 厘米", color: "棕", material: "纸" } }),
    piece({ id: "U-501", motherId: "MO-501", subId: "SO-501A", sku: "定制杯", name: "定制杯", stage: "已入波次", slot: "OC-06", putawayAt: t0 - 8 * 3600 * 1000, waveId: "WV-501",
      qc: { result: "通过", reason: "", size: "9 厘米", color: "绿", material: "陶瓷", photos: [photo("U-501-照片")], video: "", weight: "", at: "演示开始前", who: "质检员" } }),
    piece({ id: "U-502", motherId: "MO-501", subId: "SO-501B", sku: "定制垫", name: "定制垫", stage: "已入波次", slot: "OC-06", putawayAt: t0 - 8 * 3600 * 1000, waveId: "WV-501",
      qc: { result: "通过", reason: "", size: "10 厘米", color: "灰", material: "布", photos: [photo("U-502-照片")], video: "", weight: "", at: "演示开始前", who: "质检员" } }),
    piece({ id: "U-601", motherId: "MO-601", subId: "SO-601", sku: "定制杯", name: "定制杯", stage: "已拣货", putawayAt: t0 - 20 * 3600 * 1000, waveId: "WV-601",
      qc: { result: "通过", reason: "", size: "9 厘米", color: "白", material: "陶瓷", photos: [photo("U-601-照片")], video: "", weight: "", at: "演示开始前", who: "质检员" } }),
    piece({ id: "U-701", motherId: "MO-701", subId: "SO-701", sku: "定制杯", name: "定制杯", stage: "已打包", putawayAt: t0 - 26 * 3600 * 1000, waveId: "WV-701", reviewed: true,
      qc: { result: "通过", reason: "", size: "9 厘米", color: "白", material: "陶瓷", photos: [photo("U-701-照片")], video: "", weight: "", at: "演示开始前", who: "质检员" } }),
    piece({ id: "U-801", motherId: "MO-801", subId: "SO-801", sku: "定制杯", name: "定制杯", stage: "已出库称重", putawayAt: t0 - 30 * 3600 * 1000, waveId: "WV-801", reviewed: true,
      qc: { result: "通过", reason: "", size: "9 厘米", color: "白", material: "陶瓷", photos: [photo("U-801-照片")], video: "", weight: "", at: "演示开始前", who: "质检员" } }),
    piece({ id: "U-901", motherId: "MO-901", subId: "SO-901", sku: "破损杯", name: "破损杯", stage: "已上废品库位", scrapSlot: "SCRAP-01",
      qc: { result: "不通过", reason: "破损", size: "9 厘米", color: "白", material: "陶瓷", photos: [photo("U-901-照片")], video: "", weight: "", at: "演示开始前", who: "质检员" } }),
    piece({ id: "U-003", motherId: "MO-10087", subId: "SO-87", sku: "定制摆件", name: "定制摆件", warehouse: "淮安仓", via: "还没进集货仓", stage: "待调出", spec: "先到了淮安，集货仓是杭州", expect: { size: "8 厘米", color: "棕色", material: "树脂" } }),
    piece({ id: "U-088", motherId: "MO-10088", subId: "SO-88", sku: "定制礼盒杯", name: "定制礼盒杯", spec: "质检通过后要装进礼盒并贴标", expect: { size: "杯高 9 厘米", color: "白色", material: "陶瓷" } }),
    piece({ id: "U-HA1", motherId: "MO-HA01", subId: "SO-HA1", sku: "淮安定制杯", name: "淮安定制杯", warehouse: "淮安仓", via: "工厂直发", stage: "待工厂复核", spec: "一单一件，淮安复核后直发" }),
    piece({ id: "U-HA2A", motherId: "MO-HA02", subId: "SO-HA2A", sku: "淮安杯", name: "淮安杯", warehouse: "淮安仓", via: "工厂多件复核后直发", stage: "待工厂复核", spec: "多件的第 1 件" }),
    piece({ id: "U-HA2B", motherId: "MO-HA02", subId: "SO-HA2B", sku: "淮安盘", name: "淮安盘", warehouse: "淮安仓", via: "工厂多件复核后直发", stage: "待工厂复核", spec: "多件的第 2 件" }),
    piece({ id: "U-HA3", motherId: "MO-HA03", subId: "SO-HA3", sku: "超大定制画", name: "超大定制画", warehouse: "淮安仓", via: "超尺寸转杭州", stage: "待工厂复核", spec: "超尺寸，淮安发不出去", exception: "超尺寸" }),
  ];
  const locs = [
    { id: "OC-02", type: "一般库位", kind: "order", status: "已提前匹配", motherId: "MO-102", cap: 2 },
    { id: "OC-03", type: "一般库位", kind: "order", status: "占用中", motherId: "MO-201", cap: 2 },
    { id: "OC-04", type: "一般库位", kind: "order", status: "占用中", motherId: "MO-301", cap: 2 },
    { id: "OC-05", type: "一般库位", kind: "order", status: "占用中", motherId: "MO-401", cap: 2 },
    { id: "OC-06", type: "一般库位", kind: "order", status: "占用中", motherId: "MO-501", cap: 2 },
    { id: "OC-07", type: "一般库位", kind: "order", status: "空闲", motherId: "", cap: 2 },
    { id: "OC-08", type: "一般库位", kind: "order", status: "占用中", motherId: "MO-311", cap: 2 },
    { id: "OC-11", type: "一般库位", kind: "order", status: "空闲", motherId: "", cap: 2 },
    { id: "OC-09", type: "更大库位", kind: "order", status: "空闲", motherId: "", cap: 6 },
    { id: "OC-10", type: "地堆库位", kind: "order", status: "空闲", motherId: "", cap: 20 },
    { id: "SCRAP-01", type: "废品库位", kind: "scrap", status: "在用", motherId: "", cap: 99 },
    { id: "SCRAP-02", type: "废品库位", kind: "scrap", status: "空闲", motherId: "", cap: 99 },
  ];
  const bins = [
    { id: "BIN-086", status: "空闲", motherId: "", pieceIds: [] },
    { id: "BIN-090", status: "空闲", motherId: "", pieceIds: [] },
    { id: "BIN-099", status: "空闲", motherId: "", pieceIds: [] },
    { id: "BIN-102", status: "装货中", motherId: "MO-102", pieceIds: ["U-102"] },
    { id: "BIN-110", status: "空闲", motherId: "", pieceIds: [] },
    { id: "BIN-111", status: "空闲", motherId: "", pieceIds: [] },
  ];
  const wave = (partial) => Object.assign({
    channel: "", waybill: "", printed: false, stopped: false, reviewAt: null,
    packed: false, weight: null, weightOk: false, packVideo: null, oms: "",
    voidReason: "",
  }, partial);
  const waves = [
    wave({ id: "WV-301", motherId: "MO-301", kind: "多件波次", mode: "整单", source: "自动凑齐", status: "待打单", pieceIds: ["U-301", "U-302"] }),
    wave({ id: "WV-311", motherId: "MO-311", kind: "单件波次", mode: "整单", source: "自动凑齐", status: "待打单", pieceIds: ["U-311"] }),
    wave({ id: "WV-501", motherId: "MO-501", kind: "多件波次", mode: "整单", source: "自动凑齐", status: "待拣货", pieceIds: ["U-501", "U-502"], channel: "演示渠道", waybill: "WB501", printed: true }),
    wave({ id: "WV-601", motherId: "MO-601", kind: "单件波次", mode: "整单", source: "自动凑齐", status: "待打包", pieceIds: ["U-601"], channel: "演示渠道", waybill: "WB601", printed: true }),
    wave({ id: "WV-701", motherId: "MO-701", kind: "单件波次", mode: "整单", source: "自动凑齐", status: "待出库称重", pieceIds: ["U-701"], channel: "演示渠道", waybill: "WB701", printed: true, packed: true, packVideo: { name: "MO-701-打包视频", kind: "打包视频", status: "在系统服务器" } }),
    wave({ id: "WV-801", motherId: "MO-801", kind: "单件波次", mode: "整单", source: "自动凑齐", status: "已出库称重", pieceIds: ["U-801"], channel: "演示渠道", waybill: "WB801", printed: true, packed: true, weight: 418, weightOk: true, oms: "已向客户发货", packVideo: { name: "MO-801-打包视频", kind: "打包视频", status: "在系统服务器" } }),
  ];
  pieces.forEach(p => {
    if (p.stage !== "待收货") addSeedEvent(p);
  });
  return {
    page: "kanban", role: "仓库管理员", seq: 20, bucket: "",
    focus: "MO-10086", query: "", channel: "",
    notice: false, last: null, next: null,
    mothers, pieces, locs, bins, waves,
    transfers: [
      { id: "DB-003", from: "淮安仓", to: "杭州仓", status: "待主管确认", pieceIds: ["U-003"] },
    ],
    asm: null,
    logs: [{ t: "演示开始", who: "系统", step: "准备", text: "上游已经把母订单、子订单、定制品 ID 和集货仓交给仓库。仓库不在现场改集货仓。", id: "", motherId: "" }],
    anomalies: [],
    qc: null, shelf: null, scrap: null, pick: null, pack: null, weigh: null, stockWh: "全部",
    checks: [], label: "", checkSlot: "",
    recvUndo: null,
    cutoff: "16:00",
    reviewWhich: "多件",
    boxes: [
      { id: "ASN-10086", express: "SF86001", supplier: "淮安工厂", motherId: "MO-10086", beforeCutoff: true, ok: false, diff: "", lines: [{ id: "U-001", expect: 1, actual: null }, { id: "U-002", expect: 1, actual: null }] },
      { id: "ASN-10090", express: "SF90001", supplier: "淮安工厂", motherId: "MO-10090", beforeCutoff: true, ok: false, diff: "", lines: [{ id: "U-090A", expect: 1, actual: null }, { id: "U-090B", expect: 1, actual: null }] },
      { id: "ASN-10099", express: "SF99001", supplier: "淮安工厂", motherId: "MO-10099", beforeCutoff: true, ok: false, diff: "", lines: [{ id: "U-099", expect: 1, actual: null }] },
      { id: "ASN-10088", express: "SF88001", supplier: "淮安工厂", motherId: "MO-10088", beforeCutoff: true, ok: false, diff: "", lines: [{ id: "U-088", expect: 1, actual: null }] },
    ],
    moves: [], specials: [], returns: [],
  };
}

function addSeedEvent(p) {
  const steps = {
    "已收货待质检": ["收货", "收货员扫过这个定制品 ID，放到待质检区。没有占订单仓，没有启动 72 小时。"],
    "质检通过待上架": ["质检", "质检通过，已放进上架盆。还没上架成功，72 小时还没开始。"],
    "已上架": ["上架", "上架四步已经做完，在这张母订单的订单仓库位里。"],
    "已入波次": ["波次", "面单已打印，等拣货员按面单来拣。"],
    "已拣货": ["拣货", "已从库位拣出，库位已释放，等打包台复核。"],
    "已打包": ["复核", "打包员已经二次扫面单。状态是已打包、待称重，还不是已向客户发货。"],
    "已出库称重": ["称重", "发货员称重成功。回写订单中台：已向客户发货。"],
    "已上废品库位": ["质检", "质检不通过，质检员已扫上本仓废品库位。不占订单仓，不进波次。"],
    "待调出": ["调拨", "这件先到了别的仓库。主管还没确认调拨单之前，不能在集货仓收成已收货，也不能质检、上架。"],
  };
  const hit = steps[p.stage];
  if (!hit) return;
  p.events.push({ t: "演示开始前", who: hit[0] === "称重" ? "发货员" : "演示岗位", role: "系统", step: hit[0], text: hit[1], status: p.stage });
}

let S = seed();

function motherById(id) { return S.mothers.find(x => x.id === id); }
function piecesOf(id) { return S.pieces.filter(x => x.motherId === id); }
function pieceById(id) { return S.pieces.find(x => x.id === id); }
function locById(id) { return S.locs.find(x => x.id === id); }
function binById(id) { return S.bins.find(x => x.id === id); }
function waveById(id) { return S.waves.find(x => x.id === id); }
function waveOfPiece(p) { return p && p.waveId ? waveById(p.waveId) : null; }
function subOf(p) {
  const mo = motherById(p.motherId);
  return mo ? mo.subs.find(s => s.id === p.subId) : null;
}
function failed(p) { return p.stage === "质检不通过" || p.stage === "已上废品库位"; }
function onSlot(p) { return p.stage === "已上架" || p.stage === "已入波次"; }
function shelvedLike(p) { return ["已上架", "已入波次", "已拣货", "复核通过", "已打包", "已出库称重"].includes(p.stage); }

function allow(action) {
  if (S.role === "仓库管理员") return true;
  return (POSTS[action] || []).includes(S.role);
}
function need(action) {
  if (allow(action)) return true;
  const who = (POSTS[action] || ["对应岗位"]).join("或");
  toast("这一步由" + who + "做。你现在是" + S.role + "。右上角可以换岗位。仓库管理员可以代点。");
  return false;
}
function toast(msg) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("show"), 4200);
}
function say(kind, text) {
  S.last = { kind, text, page: S.page };
  toast(text.replace(/<[^>]+>/g, ""));
}
function goNext(page, label) { S.next = { page, label }; }
function nextId(prefix) { S.seq += 1; return prefix + String(S.seq).padStart(3, "0"); }

function overdue(mo) {
  if (!mo || !mo.clockStart) return false;
  return Date.now() - mo.clockStart - (mo.holidayPauseMs || 0) >= H72;
}
function clockText(mo) {
  if (!mo.clockStart) return "还没有起算。只质检通过、还在上架盆里，或者质检不通过，都不启动。";
  const elapsed = Date.now() - mo.clockStart - (mo.holidayPauseMs || 0);
  const left = H72 - elapsed;
  const pause = mo.holidayPauseMs ? "已按演练暂停过法定节假日，已走的时间没有清零。" : "含夜间和周末。";
  if (left <= 0) return "已超过 72 小时。" + pause;
  const h = Math.floor(left / 3600000);
  const m = Math.floor((left % 3600000) / 60000);
  return "还剩约 " + h + " 小时 " + m + " 分。" + pause;
}
function allGoodShelved(mo) {
  const ps = piecesOf(mo.id);
  if (!ps.length || ps.some(failed)) return false;
  return ps.every(shelvedLike);
}
function motherStatus(mo) {
  const ps = piecesOf(mo.id);
  if (!ps.length || ps.every(p => p.stage === "待收货")) return "待收货";
  if (ps.every(p => ["待收货", "待调出", "调拨在途"].includes(p.stage))) return "等调入集货仓";
  const shipped = ps.filter(p => p.stage === "已出库称重");
  const rest = ps.filter(p => !failed(p));
  if (shipped.length && (ps.some(failed) || rest.some(p => p.stage !== "已出库称重"))) return "部分出库";
  if (rest.length && rest.every(p => p.stage === "已出库称重") && !ps.some(failed)) return "已出库称重";
  const active = S.waves.filter(w => w.motherId === mo.id && !w.stopped);
  if (active.some(w => w.status === "待出库称重")) return "待出库称重";
  if (active.some(w => w.status === "待打包")) return "待打包";
  if (active.some(w => w.status === "待二次分拣")) return "待二次分拣";
  if (active.some(w => w.status === "拣货中" || w.status === "待拣货")) return "拣货中";
  const shelvedFree = ps.filter(p => p.stage === "已上架" && !p.waveId);
  const shelvedHeld = ps.filter(p => p.stage === "已上架" && p.waveId);
  if (shelvedHeld.length && shelvedFree.length) return "部分已入波次";
  if (overdue(mo) && shelvedFree.length && !allGoodShelved(mo)) return "待拆单";
  if (allGoodShelved(mo) && ps.some(p => p.stage === "已上架")) return "已凑齐";
  return "集货中";
}
function kindOf(n) { return n >= 2 ? "多件波次" : "单件波次"; }

function createWave(mo, pcs, mode, source) {
  if (!pcs.length) return null;
  const w = {
    id: nextId("WV"), motherId: mo.id, kind: kindOf(pcs.length), mode, source,
    status: "待打单", pieceIds: pcs.map(p => p.id),
    channel: "", waybill: "", printed: false, stopped: false, reviewAt: null,
    packed: false, weight: null, weightOk: false, packVideo: null, oms: "", voidReason: "",
  };
  pcs.forEach(p => { p.waveId = w.id; });
  S.waves.unshift(w);
  pcs.forEach(p => addEvent(p, "系统", "波次", "系统建成" + w.kind + "（" + mode + "，来源：" + source + "）。还没打面单，件仍是已上架。"));
  return w;
}
function afterPutaway(mo) {
  const waiting = piecesOf(mo.id).filter(p => p.stage === "已上架" && !p.waveId);
  if (allGoodShelved(mo) && waiting.length) createWave(mo, waiting, "整单", "自动凑齐");
}
function autoSplit(mo) {
  if (!overdue(mo) || allGoodShelved(mo)) return null;
  const waiting = piecesOf(mo.id).filter(p => p.stage === "已上架" && !p.waveId);
  if (!waiting.length) return null;
  return createWave(mo, waiting, "拆单", "自动超时");
}
function matchLocation(mo) {
  if (mo.locationId) return locById(mo.locationId);
  const n = piecesOf(mo.id).filter(p => !failed(p)).length;
  const type = n <= 2 ? "一般库位" : n <= 6 ? "更大库位" : "地堆库位";
  const loc = S.locs.find(l => l.kind === "order" && l.type === type && l.status === "空闲");
  if (!loc) return null;
  loc.status = "已提前匹配";
  loc.motherId = mo.id;
  mo.locationId = loc.id;
  return loc;
}
function assignBin(mo) {
  let bin = S.bins.find(b => b.motherId === mo.id && b.status === "装货中");
  if (bin) return bin;
  bin = S.bins.find(b => b.status === "空闲");
  if (!bin) {
    bin = { id: nextId("BIN"), status: "空闲", motherId: "", pieceIds: [] };
    S.bins.push(bin);
  }
  bin.status = "装货中";
  bin.motherId = mo.id;
  bin.pieceIds = [];
  return bin;
}
function releaseSlot(mo) {
  const loc = mo.locationId ? locById(mo.locationId) : null;
  if (!loc || loc.kind !== "order") return;
  piecesOf(mo.id).forEach(p => {
    if (p.slot === loc.id && p.stage === "已拣货") p.slot = "";
  });
  loc.status = "空闲";
  loc.motherId = "";
  mo.locationId = "";
}
function anomaly(code, why) {
  S.anomalies.unshift({ t: now(), who: S.role, page: S.page, code, why });
}

function boxOfPiece(id) {
  return (S.boxes || []).find(b => b.lines.some(l => l.id === id));
}
function boxOpen(id) {
  const b = (S.boxes || []).find(x => x.id === id || x.express === id);
  return b || null;
}
function unfinishedBoxes() {
  return (S.boxes || []).filter(b => b.beforeCutoff && b.lines.some(l => {
    const p = pieceById(l.id);
    return p && p.stage === "待收货";
  }));
}

function bucketOf(p) {
  if (p.stage === "已出库称重") return "已出库";
  if (p.stage === "已上废品库位") return "废品库位件数";
  if (p.stage === "已打包") return "待称重";
  if (p.stage === "已拣货" || p.stage === "复核通过") return "待复核";
  if (p.stage === "已入波次") return "待拣";
  if (p.stage === "已上架" && p.waveId) return "可打波次";
  if (p.stage === "已上架" && overdue(motherById(p.motherId)) && !allGoodShelved(motherById(p.motherId))) return "超时可拆发";
  if (p.stage === "已上架") return "在库待齐";
  if (p.stage === "质检通过待上架") return "待上架";
  if (p.stage === "待组装") return "待组装";
  if (p.stage === "已收货待质检") return "待质检";
  if (p.stage === "调拨在途") return "调拨在途";
  if (p.stage === "待调出") return "待调出";
  return "";
}
const BUCKETS = ["待调出", "调拨在途", "待质检", "待组装", "待上架", "在库待齐", "可打波次", "超时可拆发", "待拣", "待复核", "待称重", "已出库", "废品库位件数"];
const BUCKET_PAGE = {
  "待调出": "transfer", "调拨在途": "transfer", "待质检": "qc", "待组装": "assemble", "待上架": "putaway",
  "在库待齐": "stock", "可打波次": "wave", "超时可拆发": "wave",
  "待拣": "pick", "待复核": "pack", "待称重": "weigh", "已出库": "trace", "废品库位件数": "stock",
};
function bucketPieces(name) { return S.pieces.filter(p => bucketOf(p) === name); }

function progress(id) {
  const ps = piecesOf(id);
  const got = (pid) => { const p = pieceById(pid); return p && p.stage !== "待收货"; };
  const pastQc = (pid) => { const p = pieceById(pid); return p && !["待收货", "已收货待质检"].includes(p.stage); };
  const shelved = (pid) => { const p = pieceById(pid); return p && shelvedLike(p); };
  if (id === "MO-10087") return transferProgress();
  if (id === "MO-10088") return assembleProgress();
  if (id === "MO-10086") {
    const w = S.waves.find(x => x.motherId === id && !x.stopped && x.pieceIds.includes("U-001"));
    const box = boxOpen("SF86001");
    return [
      { name: "小邮局清点集货快递箱 SF86001", who: "收货员", page: "post", done: !!(box && box.ok), note: "对上到货单 ASN-10086，箱里 U-001、U-002 各 1 件，和供应商发货清单一致。对不上不能收货。" },
      { name: "收货员扫 U-001", who: "收货员", page: "receive", done: got("U-001"), note: "扫一次只收这一件。状态变成已收货待质检。不占订单仓，不启动 72 小时。" },
      { name: "收货员扫 U-002", who: "收货员", page: "receive", done: got("U-002"), note: "同一张母订单的第二件。扫一次不能把两件一起收完。" },
      { name: "质检员给 U-001 拍照并通过", who: "质检员", page: "qc", done: pastQc("U-001"), note: "通过后放进这张单的上架盆。还没上架，72 小时仍不开始。" },
      { name: "质检员给 U-002 拍照并通过", who: "质检员", page: "qc", done: pastQc("U-002"), note: "两件合格品进同一只上架盆。盆被领走上架之后，后到的合格品才换新盆。" },
      { name: "上架员走完四步", who: "上架员", page: "putaway", done: shelved("U-001") && shelved("U-002"), note: "扫盆、扫库位、逐件扫定制品 ID、回扫空盆。两件都上到同一个订单仓库位。第一件占用时 72 小时开始。凑齐后系统建多件波次。" },
      { name: "拣货员打出多件波次的面单", who: "拣货员", page: "wave", done: !!(w && w.printed), note: "先选物流渠道。单件和多件不能打在同一张波次里。每张母订单仍是自己的面单。" },
      { name: "拣货员按面单逐件拣", who: "拣货员", page: "pick", done: ["U-001", "U-002"].every(pid => { const p = pieceById(pid); return p && ["已拣货", "复核通过", "已打包", "已出库称重"].includes(p.stage); }), note: "先扫面单，再扫 U-001、U-002。两件都拣完，库位释放，可以直接去多件复核。二次分拣是另外一屏，需要归拢时再用。" },
      { name: "打包员在多件复核里逐件复核并封箱", who: "打包员", page: "many", done: ["U-001", "U-002"].every(pid => { const p = pieceById(pid); return p && ["已打包", "已出库称重"].includes(p.stage); }), note: "同款多件和多款多件都走多件复核。不经过二次分拣也能打开。二次扫面单还不是已发货。" },
      { name: "发货员扫码并称重", who: "发货员", page: "weigh", done: ["U-001", "U-002"].every(pid => pieceById(pid) && pieceById(pid).stage === "已出库称重"), note: "称重成功才回写已向客户发货。重量有差异也不拦截。" },
      { name: "装载交接并打出当日交接清单", who: "发货员", page: "load", done: !!(w && w.handover), note: "不移入笼车。没称重成功的运单不进清单。" },
    ];
  }
  const p = pieceById("U-099");
  const box99 = boxOpen("SF99001");
  return [
    { name: "小邮局清点 SF99001", who: "收货员", page: "post", done: !!(box99 && box99.ok), note: "这一箱只有 U-099 一件。清点对上供应商清单后才能收货。" },
    { name: "收货员扫 U-099", who: "收货员", page: "receive", done: p && p.stage !== "待收货", note: "一单一件也要单独扫这个定制品 ID。收完是已收货待质检。" },
    { name: "质检员拍照并选择不通过", who: "质检员", page: "qc", done: p && failed(p), note: "少照片不能提交。不通过要写原因。不要放进合格品上架盆。不能改判通过。" },
    { name: "质检员扫上废品库位", who: "质检员", page: "qc", done: p && p.stage === "已上废品库位", note: "在本仓扫废品库位，不另建废品仓。不占订单仓，不进波次，不能发给买家。" },
    { name: "看订单侧两条出路", who: "订单中台的人选，仓员不代选", page: "qc", done: !!(p && p.orderSide), note: "原订单号不变、工厂来新的定制品 ID 再收货质检；或取消并退款。退款不在仓库里做，仓库只确认货在废品库位。" },
  ];
}

function resultBox() {
  if (!S.last || S.last.page !== S.page) return "";
  const cls = S.last.kind === "bad" ? "badnote" : "oknote";
  const next = S.next ? `<div style="margin-top:8px">${btn(S.next.label, "goto", { page: S.next.page }, true)}</div>` : "";
  return `<div class="${cls}" style="margin:12px 0"><div class="big">${S.last.text}</div>${next}</div>`;
}
function jobBox() {
  const job = JOB[S.page];
  if (!job) return "";
  return `<div class="oknote"><b>这一屏谁动手</b> ${esc(job.who)}<br><b>这一步要做完</b> ${esc(job.rule)}<br><span class="mini">做完交到下一屏：${esc(job.next)}</span></div>`;
}

function pageKanban() {
  const cards = BUCKETS.map(name => {
    const n = bucketPieces(name).length;
    const on = S.bucket === name ? " primary" : "";
    return `<button type="button" class="stat${on}" data-act="bucket" data-name="${esc(name)}"><b>${n}</b><span>${esc(name)}</span></button>`;
  }).join("");
  const waitingFail = S.pieces.filter(p => p.stage === "质检不通过").length;
  const list = S.bucket ? bucketPieces(S.bucket) : [];
  const rows = list.map(p => row([
    esc(p.id), esc(p.motherId), esc(p.name), badge(p.stage, p.stage === "已上废品库位" ? "bad" : "ok"),
    esc(p.slot || p.scrapSlot || p.bin || "—"), esc(motherStatus(motherById(p.motherId))),
    btn("打开这一步", "goto", { page: BUCKET_PAGE[S.bucket], id: p.motherId }),
  ]));
  const note = waitingFail ? `<div class="note">另有 ${waitingFail} 件已经判定质检不通过，还等质检员扫上废品库位。这 ${waitingFail} 件先不加进上面的「废品库位件数」。</div>` : "";
  return pageHead("今天进度", "看仓里走到哪一步。一件货只落在下面一个数字里。点数字，对得上后面的单据。") +
    `<div class="grid">${cards}</div>` + note +
    (S.bucket ? `<h2>${esc(S.bucket)} · ${list.length} 件</h2>` + table(["定制品 ID", "母订单", "商品", "状态", "库位或盆", "母订单现在", ""], rows) : "") +
    `<div class="card"><b>模拟作业还在这一组里</b><p>通过路径走 MO-10086（U-001、U-002）。不通过路径走 U-099。调拨路径走淮安的 U-003，要先调进杭州集货仓。组装路径走 U-088，质检通过后先装礼盒再上架。同款多件对照是 MO-10090。</p>${btn("打开模拟作业", "goto", { page: "sim" }, true)}</div>` +
    `<p class="mini">没有移入笼车，也没有可卖库存。称重成功回写已向客户发货，然后做装载交接。待调出和调拨在途的件还不在集货仓。影像夜里上传只是留档，不挡住出库。</p>`;
}
function pageSim() {
  const block = (title, id, intro) => {
    const steps = progress(id);
    const current = steps.findIndex(s => !s.done);
    const cards = steps.map((s, i) => {
      const state = s.done ? "做完了" : (i === current ? "现在做这一步" : "还没到");
      const kind = s.done ? "ok" : (i === current ? "warn" : "");
      const go = i === current ? btn("去做这一步", "goto", { page: s.page, id }, true) : "";
      return `<div class="card"><b>${i + 1}. ${esc(s.name)}</b> ${badge(state, kind)}<p class="mini">谁动手：${esc(s.who)}</p><p>${esc(s.note)}</p>${go}</div>`;
    }).join("");
    const done = current < 0 ? `<div class="oknote">这条模拟路径的仓内步骤已经点完。</div>` : "";
    return `<h2>${esc(title)}</h2><p class="sub">${esc(intro)}</p>${done}${cards}`;
  };
  return pageHead("模拟作业", "用现成的单和预设的定制品 ID，从收货点到后面。点按钮就当作扫码枪扫到了。") +
    block("路径一 · 质检通过，直到称重和交接", "MO-10086", "多款多件：2 个子订单、2 个定制品 ID。先在小邮局清点集货快递箱，再一件一件收。两件都合格后走多件复核，称重才回写已向客户发货，然后装载交接。") +
    block("路径二 · 质检不通过，进入废品库位", "MO-10099", "一单一件。不通过后由质检员扫上本仓废品库位。订单侧可以看原单重做或取消退款，退款不在仓库完成。") +
    `<div class="card"><b>同款多件长什么样</b><p>MO-10090 只有 1 个子订单 SO-90，购买数量 2，下面是 U-090A 和 U-090B，商品款相同。收货、质检、上架仍是每件各扫一次。这条不是主路径，需要时在收货屏点它。</p></div>` +
    block("路径三 · 货在别的仓，先调拨再进集货仓", "MO-10087", "U-003 先在淮安。集货仓是杭州。主管确认调拨单，调拨员在淮安扫出、在杭州扫入。调入之后才是已收货待质检，72 小时还没开始。") +
    block("路径四 · 质检通过后先组装，再上架", "MO-10088", "U-088 的订单带了装进礼盒，并贴客供标。贴标不另开一条贴完就上架的路。质检通过后先到组装工位，做完才进上架盆。") +
    `<h2>路径五 · 淮安单件复核直发</h2><p class="sub">U-HA1 只有一件，在淮安复核后直接去称重。不进杭州质检和上架，72 小时不从淮安起算。打面单当时还不写成已向客户发货。</p><div class="card">${btn("打开淮安复核", "goto", { page: "factory" }, true)}</div>` +
    `<h2>路径六 · 淮安多件也可以直发</h2><p class="sub">U-HA2A、U-HA2B 在淮安做多件复核后直接去称重。不因为是多件就改送到杭州。72 小时不从淮安起算。打面单当时还不写成已向客户发货。</p><div class="card">${btn("打开淮安复核", "goto", { page: "factory" }, true)}</div>` +
    `<h2>路径七 · 淮安发不出去才转杭州</h2><p class="sub">U-HA3 超尺寸。只有超尺寸、物流渠道到不了、地址或国家有问题，才转到杭州。到了杭州仍要质检、上架。72 小时不从淮安起算。不打顾客面单。</p><div class="card">${btn("打开淮安复核", "goto", { page: "factory" }, true)}</div>`;
}
function assembleProgress() {
  const p = pieceById("U-088");
  if (!p) return [];
  const pastQc = !["待收货", "已收货待质检"].includes(p.stage);
  const readyShelf = ["质检通过待上架", "已上架", "已入波次", "已拣货", "复核通过", "已打包", "已出库称重"].includes(p.stage);
  const box88 = boxOpen("SF88001");
  return [
    { name: "小邮局清点 SF88001", who: "收货员", page: "post", done: !!(box88 && box88.ok), note: "先按集货快递箱清点 U-088 的件数。" },
    { name: "收货员在杭州仓扫 U-088", who: "收货员", page: "receive", done: p.stage !== "待收货", note: "这件本来就在集货仓，不用调拨。扫一次只收一件。" },
    { name: "质检员拍照并通过", who: "质检员", page: "qc", done: pastQc, note: "订单带了装进礼盒和贴标。通过后状态是待组装，不放进上架盆，72 小时不开始。" },
    { name: "组装员扫 U-088，再点组装完成", who: "组装员", page: "assemble", done: readyShelf, note: "贴标也在这一岗做完。少扫就不能完成。做完才进上架盆。" },
  ];
}
function transferProgress() {
  const p = pieceById("U-003");
  const db = (S.transfers || []).find(t => t.pieceIds.includes("U-003"));
  if (!p) return [];
  return [
    { name: "主管确认调拨单 DB-003", who: "仓库主管", page: "transfer", done: db && db.status !== "待主管确认", note: "调出淮安，调入杭州。不能打印顾客面单。" },
    { name: "调拨员在淮安扫 U-003 交出", who: "调拨员", page: "transfer", done: p.stage === "调拨在途" || p.warehouse === "杭州仓", note: "变成调拨在途。两个仓都不算在库，也不能进波次。" },
    { name: "调拨员在杭州再扫 U-003", who: "调拨员", page: "transfer", done: p.warehouse === "杭州仓" && !["待调出", "调拨在途"].includes(p.stage), note: "当前仓库改成杭州，状态变成已收货待质检。应收件数不加。同一张母订单的清单自动合上。" },
  ];
}

function recvSummary(mo) {
  const ps = piecesOf(mo.id);
  const notHere = (p) => ["待收货", "待调出", "调拨在途"].includes(p.stage);
  const got = ps.filter(p => !notHere(p)).length;
  const lack = ps.filter(notHere).map(p => p.id).join("、") || "没有了";
  return `${mo.id} · ${mo.shape} · 已收 ${got} / 应收 ${ps.length}。还缺：${lack}。`;
}
function pageReceive() {
  const waiting = S.pieces.filter(p => p.stage === "待收货");
  const chips = waiting.map(p => btn("当作扫到 " + p.id, "do-receive", { code: p.id })).join(" ");
  const rows = S.mothers.map(mo => {
    const ps = piecesOf(mo.id);
    const notHere = (p) => ["待收货", "待调出", "调拨在途"].includes(p.stage);
    const got = ps.filter(p => !notHere(p)).length;
    return row([esc(mo.id), esc(mo.hub), esc(mo.shape), esc(got + " / " + ps.length), esc(ps.map(p => p.id + "·" + p.warehouse + "·" + p.stage).join("；")), badge(motherStatus(mo), motherStatus(mo) === "待收货" ? "" : "warn")]);
  });
  return pageHead("收货", "小邮局清点之后，收货员扫定制品 ID。扫一次只收一件。系统核对它属于哪张母订单、哪个子订单，以及应有几件。") +
    `<div class="card"><p>光标对着这一件的码。下面这些按钮就是演练用的扫码。</p><div class="row" style="margin:8px 0">${chips}</div>
    <form class="row" data-form="receive"><label class="f">或输入定制品 ID<input name="code" autocomplete="off" placeholder="例如 U-001" /></label><button class="btn primary">扫这个码收货</button></form>
    <p class="mini">主路径要先在小邮局清点 SF86001，再扫 U-001、U-002。扫一次不能把一个子订单的购买数量全部收完。U-003 在淮安，这一屏扫它会被拒绝。</p></div>` +
    (S.recvUndo && Date.now() - S.recvUndo.at < 60000 ? `<div class="note">刚刚收了 ${esc(S.recvUndo.id)}。60 秒内可以撤销，只撤回这一件。</div><div>${btn("撤销本次收货", "undo-receive")}</div>` : "") +
    table(["母订单", "集货仓", "结构", "已到集货仓/应收", "每一件", "母订单"], rows);
}
function pageQc() {
  const waiting = S.pieces.filter(p => p.stage === "已收货待质检" || p.stage === "质检不通过");
  const chips = waiting.map(p => btn("当作扫到 " + p.id, "open-qc", { code: p.id })).join(" ");
  const q = S.qc;
  let body = "";
  if (q && pieceById(q.id)) {
    const p = pieceById(q.id);
    const sub = subOf(p);
    body += `<div class="card"><b>${esc(p.motherId)}</b> · 子订单 ${esc(p.subId)} · 定制品 ID ${esc(p.id)}<br>${esc(p.name)} · ${esc(p.spec || "")}<br>这一款购买数量 ${sub ? sub.qty : 1}。${p.highValue ? badge("高价值，必须录像", "warn") : "不是高价值，质检不要求录像。"}<p>现在状态：${badge(p.stage, failed(p) ? "bad" : "warn")}</p></div>`;
    if (p.stage === "已收货待质检") {
      body += `<div class="card"><div class="row">${btn("拍照（演练照片）", "qc-photo", {}, true)} ${p.highValue ? btn(q.video ? "质检视频已保存" : "开始质检录像", "qc-video") : ""} ${btn("读取质检秤", "qc-weight")}</div>
        <p class="mini">${q.photo ? "照片已在系统服务器。少照片不能提交。" : "还没有照片。通过和不通过都不能点。"} ${q.weightNote || "秤没读到也不挡住结论。"}</p>
        <div class="row"><div class="ph">${q.photo ? "演练照片<br>已留档" : "等拍照"}</div>
        <label class="f">尺寸<input id="qc-size" value="${esc(q.size)}" ${q.manual ? "" : "readonly"} /></label>
        <label class="f">颜色<input id="qc-color" value="${esc(q.color)}" ${q.manual ? "" : "readonly"} /></label>
        <label class="f">材质<input id="qc-material" value="${esc(q.material)}" ${q.manual ? "" : "readonly"} /></label></div>
        <p>${btn("识别失败，改为手填", "qc-manual")}</p>
        <div class="row">${btn("质检通过", "qc-pass", {}, true)}
          <label class="f">不通过原因<select id="qc-reason"><option>破损</option><option>尺寸不符</option><option>颜色不符</option><option>材质不符</option><option>其他</option></select></label>
          ${btn("质检不通过", "qc-fail")}</div>
        <p class="mini">没有「改判通过」，也没有「把这件修好再发」。订单侧重做或退款不在提交结论时选。</p></div>`;
    } else if (p.stage === "质检不通过") {
      body += `<div class="badnote"><div class="big">不要放入合格品上架盆</div><p>照片已保留，准备报废。请质检员再扫一次 ${esc(p.id)}，然后扫废品库位 ${esc(p.scrapTarget)}。不另建废品仓。</p></div>
        <div class="row" style="margin-top:8px">${btn("第 1 下：扫 " + p.id, "scrap-id", { code: p.id }, S.scrap && S.scrap.idOk)}${btn("第 2 下：扫 " + p.scrapTarget, "scrap-loc", { code: p.scrapTarget }, true)}</div>`;
    } else if (p.stage === "已上废品库位") {
      body += scrapSide(p);
    } else {
      body += `<div class="note">这一件当前是「${esc(p.stage)}」，不用在质检屏再提交一次。</div>`;
    }
  }
  const scrapRows = S.pieces.filter(p => failed(p)).map(p => row([
    esc(p.id), esc(p.motherId), badge(p.stage, "bad"), esc(p.scrapSlot || p.scrapTarget || "—"),
    esc((p.qc && p.qc.reason) || "—"), p.qc && p.qc.photos && p.qc.photos.length ? "照片还在" : "没有照片",
    btn("打开", "open-qc", { code: p.id }),
  ], "bad"));
  return pageHead("质检", "质检员扫已经在集货仓收过的定制品 ID。没带增值服务的，通过后进上架盆；带了增值服务的，通过后去组装；不通过扫上本仓废品库位。") +
    `<div class="card"><div class="row">${chips || "<span class='mini'>现在没有待质检的件。先去收货。</span>"}</div>
    <form class="row" data-form="qc"><label class="f">或输入定制品 ID<input name="code" autocomplete="off" /></label><button class="btn">打开这件</button></form></div>` +
    body +
    `<h2>不通过和废品</h2>` + table(["定制品 ID", "母订单", "状态", "废品库位", "原因", "照片", ""], scrapRows);
}
function scrapSide(p) {
  const redo = p.orderSide === "原订单重做";
  const cancel = p.orderSide === "取消并退款";
  return `<div class="badnote"><div class="big">已上废品库位 ${esc(p.scrapSlot)}</div>
    <p>谁做的：质检员。状态已变成「已上废品库位」。不占订单仓，不进波次，不能改判通过，不能发给买家。仓里不把这件修好再发。照片仍留着。</p></div>
    <div class="card"><b>订单侧两条出路</b><p>由订单中台的人选。仓员不代选。仓库没有退款按钮。</p>
    <div class="row">${btn("原订单重做", "order-redo", { id: p.id })} ${btn("取消并退款", "order-cancel", { id: p.id })}</div>
    ${redo ? `<p>已记下：原订单号 ${esc(p.motherId)} 不变。旧件留在废品库位。工厂的新定制品 ID 是 <b>${esc(p.redoId)}</b>，等收货员再收、再质检。不是在废品上改个码重发。</p>` : ""}
    ${cancel ? `<p>已记下：订单中台取消并退款。退款不在仓库完成。仓库只确认 ${esc(p.id)} 还在 ${esc(p.scrapSlot)}，不再可发。</p>` : ""}
    ${!p.orderSide ? `<p class="mini">还没选。两条都可以点开看结果，点的是订单侧会怎么做，不是仓员做主。</p>` : ""}</div>`;
}
function pagePutaway() {
  const bins = S.bins.filter(b => b.status === "装货中" || b.status === "上架中");
  const chips = bins.map(b => btn("当作扫到上架盆 " + b.id + "（" + b.motherId + "）", "shelf-bin", { code: b.id })).join(" ");
  const sh = S.shelf;
  let body = `<div class="card"><p>上架员按屏幕提示扫。现在在等：<b>${sh ? esc(sh.wait) : "上架盆"}</b></p><div class="row">${chips || "<span class='mini'>没有待上架的盆。质检通过之后，盆会出现在这里。</span>"}</div></div>`;
  if (sh) {
    const mo = motherById(sh.motherId);
    const loc = locById(mo.locationId);
    const bin = binById(sh.bin);
    body += `<div class="card"><p>母订单 ${esc(mo.id)} · ${esc(mo.shape)}</p>`;
    if (loc) {
      body += `<p class="mini">PDA 上的库位</p><div class="pda">${esc(loc.id)}</div><p>${esc(loc.type)}。同一时间这张母订单只占这一个库位。${piecesOf(mo.id).length > 2 ? "件数超过一般库位，所以不是一般库位。" : "这一单件数装得下一般库位。"}</p>`;
      if (sh.step === "loc" || sh.step === "item" || sh.step === "empty") {
        body += btn("当作扫到库位 " + loc.id, "shelf-loc", { code: loc.id }, sh.step === "loc");
      }
    } else body += `<div class="badnote">还没有可匹配的空库位。不要把货记成已上架。</div>`;
    const itemRows = (bin ? bin.pieceIds : []).map(id => {
      const done = sh.placed.includes(id);
      return row([esc(id), esc(pieceById(id).name), done ? badge("已放入", "ok") : badge("未扫", "warn"), sh.step === "item" && !done ? btn("当作扫到 " + id, "shelf-item", { code: id }, true) : ""], done ? "ok" : "");
    });
    body += table(["定制品 ID", "商品", "这一步", ""], itemRows);
    if (sh.step === "empty") body += `<p>${btn("回扫空盆 " + sh.bin, "shelf-empty", { code: sh.bin }, true)}</p><p class="mini">回扫成功才算上架成功。然后把空盆带回上架车。</p>`;
    body += `<p class="mini">72 小时：${esc(clockText(mo))}</p></div>`;
  }
  const wait = S.pieces.filter(p => p.stage === "质检通过待上架");
  body += `<h2>还在上架盆里、不算在库</h2>` + table(["定制品 ID", "母订单", "上架盆", "状态"], wait.map(p => row([esc(p.id), esc(p.motherId), esc(p.bin || "—"), badge(p.stage, "warn")])));
  return pageHead("上架", "合格品从上架盆放到这张母订单唯一的订单仓库位。废品不进这一屏。") + body;
}

function pageWave() {
  const pendingSingle = S.waves.filter(w => w.status === "待打单" && !w.stopped && w.kind === "单件波次");
  const pendingMulti = S.waves.filter(w => w.status === "待打单" && !w.stopped && w.kind === "多件波次");
  const waveRow = (w) => {
    const mo = motherById(w.motherId);
    return row([
      esc(w.id), esc(w.motherId), esc(w.kind), esc(w.mode), esc(w.source), badge(w.status, w.stopped ? "bad" : "warn"),
      esc(w.waybill || "还没有面单"), esc(w.pieceIds.join("、")), esc(clockText(mo)),
      w.status === "待打单" ? btn("打印 " + w.motherId + " 的面单", "print-wave", { id: w.id }, true) : (w.stopped ? "旧面单不能发" : ""),
    ]);
  };
  const late = S.mothers.filter(mo => overdue(mo) && piecesOf(mo.id).some(p => p.stage === "已上架" && !p.waveId) && !allGoodShelved(mo));
  const canSplit = S.pieces.filter(p => p.stage === "已上架" && !p.waveId);
  return pageHead("波次和 72 小时", "系统按凑齐或超时建工单。拣货员在这里选渠道、打印面单。拆单不在拣货员的按钮上。") +
    `<div class="card"><label class="f">物流渠道（不选不能打印）<select id="channel"><option value="">请选择</option><option ${S.channel === "演示渠道" ? "selected" : ""}>演示渠道</option><option ${S.channel === "云途" ? "selected" : ""}>云途</option><option ${S.channel === "顺丰国际" ? "selected" : ""}>顺丰国际</option></select></label>
    <p class="mini">单件波次和多件波次分开列。不能混进同一次打单。每张母订单仍打自己的面单。</p></div>` +
    `<h2>单件波次 · 待打单</h2>` + table(["波次", "母订单", "件数类", "整单或拆单", "来源", "状态", "面单", "定制品 ID", "72 小时", ""], pendingSingle.map(waveRow)) +
    `<h2>多件波次 · 待打单</h2>` + table(["波次", "母订单", "件数类", "整单或拆单", "来源", "状态", "面单", "定制品 ID", "72 小时", ""], pendingMulti.map(waveRow)) +
    `<h2>超时，只拆已经在库的件</h2>` +
    (late.length ? late.map(mo => `<div class="card"><b>${esc(mo.id)}</b> ${badge(motherStatus(mo), "warn")}<p>${esc(clockText(mo))} 只带走已上架的件。只收货、只在盆里、废品，都不进这张面单。</p>${btn("系统拆出已经在库的件", "auto-split", { id: mo.id }, true)} ${btn("模拟一天法定节假日（仅演练）", "holiday", { id: mo.id })}</div>`).join("") : `<div class="card">现在没有「已经超时、还有在库件没进波次」的母订单。在库待齐的单可以点「模拟已满 72 小时（仅演练）」。</div>`) +
    S.mothers.filter(mo => mo.clockStart && !overdue(mo) && piecesOf(mo.id).some(p => p.stage === "已上架" && !p.waveId)).map(mo => `<div class="card"><b>${esc(mo.id)}</b> 还在 72 小时里。${esc(clockText(mo))}<div class="row">${btn("模拟已满 72 小时（仅演练）", "fake-72", { id: mo.id })} ${btn("模拟一天法定节假日（仅演练）", "holiday", { id: mo.id })}</div><p class="mini">正式仓没有这两个按钮。节假日只暂停计时，不改收货、上架和出库。</p></div>`).join("") +
    `<h2>还没进波次的在库件 · 专员才能拆</h2>` +
    table(["定制品 ID", "母订单", "库位", ""], canSplit.map(p => row([
      esc(p.id), esc(p.motherId), esc(p.slot || "—"),
      `<label><input type="checkbox" data-split="${esc(p.id)}" /> 拆这件</label>`,
    ]))) +
    `<div class="row" style="margin-top:8px">${btn("拆单发货", "do-split", {}, true)}</div>` +
    `<p class="mini">拣货员点这个按钮会被拒绝。未满 72 小时也可以由专员拆。已经在未完成波次里的件不会出现在这里。废品不出现。</p>` +
    `<h2>全部波次</h2>` + table(["波次", "母订单", "件数类", "整单或拆单", "来源", "状态", "面单", "定制品 ID", "72 小时", ""], S.waves.map(waveRow));
}
function pagePick() {
  const ready = S.waves.filter(w => w.printed && !w.stopped && ["待拣货", "拣货中"].includes(w.status));
  const chips = ready.map(w => btn("当作扫到面单 " + w.waybill + "（" + w.motherId + "）", "pick-bill", { code: w.waybill })).join(" ");
  let body = "";
  if (S.pick && waveById(S.pick.waveId)) {
    const w = waveById(S.pick.waveId);
    const mo = motherById(w.motherId);
    const loc = S.locs.find(l => l.motherId === mo.id && l.kind === "order") || locById(mo.locationId);
    body += `<div class="card"><p>运单 ${esc(w.waybill)} · 母订单 ${esc(mo.id)}</p><p class="mini">库位</p><div class="pda">${esc(loc ? loc.id : "已释放")}</div>
      <p>再扫定制品 ID。不要再扫一次运单号就算拣完一件。</p></div>`;
    const rows = w.pieceIds.map(id => {
      const p = pieceById(id);
      const done = p.stage === "已拣货" || ["复核通过", "已打包", "已出库称重"].includes(p.stage);
      return row([esc(id), esc(p.name), done ? badge("已拣货", "ok") : badge("未拣", "warn"), done ? "" : btn("当作扫到 " + id, "pick-item", { code: id }, true)], done ? "ok" : "");
    });
    body += table(["定制品 ID", "商品", "状态", ""], rows);
  }
  return pageHead("拣货", "拣货员拿打印出来的面单。先扫面单，再逐件扫定制品 ID。拣完这一库位上该拿的货，库位自己空出来。") +
    `<div class="card"><div class="row">${chips || "<span class='mini'>没有已打印、待拣的面单。先去波次屏打单。</span>"}</div>
    <form class="row" data-form="pick"><label class="f">或输入面单 / 定制品 ID<input name="code" autocomplete="off" /></label><button class="btn primary">扫这个码</button></form>
    <p class="mini">还没扫面单时，只扫定制品 ID 不能拣。</p></div>` + body;
}
function pagePack() {
  const whichNow = S.page === "pack" ? "" : (S.reviewWhich || "多件");
  const ready = S.waves.filter(w => w.printed && !w.stopped && w.status === "待打包" && (whichNow === "" || (whichNow === "单件" ? w.pieceIds.length < 2 : w.pieceIds.length >= 2)));
  const chips = ready.map(w => btn("当作扫到运单 " + w.waybill + "（" + w.motherId + "）", "pack-open", { code: w.waybill })).join(" ");
  let body = "";
  const pk = S.pack;
  if (pk && waveById(pk.waveId)) {
    const w = waveById(pk.waveId);
    const rows = w.pieceIds.map(id => {
      const p = pieceById(id);
      const done = pk.scanned.includes(id);
      return row([esc(p.name), esc(p.subId), esc(id), done ? badge("已复核", "ok") : badge("少件 · 未扫", "bad"), done ? "" : btn("当作扫到 " + id, "pack-item", { code: id }, true)], done ? "ok" : "bad");
    });
    pk.extras.forEach(ex => rows.unshift(row([esc(ex.code), "—", esc(ex.why), badge("多件", "bad"), ""], "bad")));
    const early = pk.early;
    body += `<div class="card"><p>运单 ${esc(w.waybill)} · 母订单 ${esc(w.motherId)} · 应复核 ${w.pieceIds.length} 件 · 已复核 ${pk.scanned.length} 件</p>
      <p>录像：${pk.camera ? badge("打包视频已在系统服务器", "ok") : badge("还没开打包台相机", "warn")}</p>
      ${early ? `<div class="badnote">目前在库还有该订单的子订单商品，请反馈现场异常订单处理专员。</div>` : ""}
      <div class="row">${pk.camera ? "" : btn("开启打包台相机", "pack-camera", {}, true)} ${btn("检查是否齐", "pack-check")} ${early ? btn("停止包裹打包复核", "pack-stop", {}, true) : ""}</div></div>`;
    body += table(["商品", "子订单", "定制品 ID", "结果", ""], rows);
    if (!early && pk.scanned.length === w.pieceIds.length && !pk.extras.length) {
      body += `<div class="oknote">${pk.sealed ? "请扫描面单。扫成功只记已打包、待称重。" : "请先封箱，封完再扫面单。"}</div><div class="row" style="margin-top:8px">${pk.sealed ? btn("二次扫面单 " + w.waybill, "pack-seal-scan", { code: w.waybill }, true) : btn("我已封箱，接下来扫描面单", "pack-sealed", {}, true)}</div>`;
    }
    if (pk.extras.length || (pk.alarm && pk.scanned.length < w.pieceIds.length)) {
      body += `<div class="badnote">请反馈现场异常订单处理专员。不能短发，也不能二次扫面单。</div>${btn("专员核实后，合格品重新上架", "pack-reshelf")}`;
    }
    body += `<p class="mini">${btn("演练：假设还有更早到库的件", "pack-early") } 这一下会停包并作废旧面单，培训时再点。和少件不是同一个按钮。</p>`;
  }
  const which = S.page === "pack" ? "" : (S.reviewWhich || "多件");
  const title = which === "单件" ? "单件复核" : which === "多件" ? "多件复核" : "复核";
  const lead = which === "单件"
    ? "一单一件在这里复核。一张面单上只有 1 个定制品 ID。"
    : which === "多件"
      ? "一单多件在这里复核。同款多件和多款多件都走这一套，不再按同款、多款拆开。"
      : "从进度点进来时，单件和多件都会列在这里。请按件数进入对应的复核。";
  return pageHead(title, lead + " 打包员扫运单号找到母订单，打开打包台相机，再按每一个定制品 ID 复核。打面单当时不写成已向客户发货。") +
    `<div class="card"><div class="row">${chips || "<span class='mini'>没有待复核的包裹。</span>"}</div>
    <form class="row" data-form="pack"><label class="f">运单号或定制品 ID<input name="code" autocomplete="off" /></label><button class="btn primary">扫这个码</button></form></div>` + body;
}
function pageWeigh() {
  const ready = S.waves.filter(w => !w.stopped && w.status === "待出库称重");
  const chips = ready.map(w => btn("当作扫到面单 " + w.waybill + "（" + w.motherId + "）", "weigh-open", { code: w.waybill })).join(" ");
  let body = "";
  if (S.weigh && waveById(S.weigh)) {
    const w = waveById(S.weigh);
    const ps = w.pieceIds.map(pieceById);
    body += `<div class="card"><p>母订单 ${esc(w.motherId)} · 运单 ${esc(w.waybill)} · ${ps.length} 件</p><ul>${ps.map(p => `<li>${esc(p.name)} · ${esc(p.id)}</li>`).join("")}</ul>
      <p>秤：${S.weighState || "未读取"}</p>
      <div class="row">${btn("读取重量", "weigh-read", {}, true)} ${btn("重量和预估不一样，仍读取", "weigh-diff")} ${btn("模拟秤读失败", "weigh-fail")}</div>
      <p class="mini">不能手填重量。重量有差异也不拦截已向客户发货。影像还没夜里上传，也可以称。这一屏没有移入笼车。</p></div>`;
  }
  const done = S.waves.filter(w => w.weightOk);
  return pageHead("称重出库", "发货员对已打包、待称重的包裹扫码，并读出库秤。称重成功才回写已向客户发货。") +
    `<div class="card"><div class="row">${chips || "<span class='mini'>没有待称重的包裹。</span>"}</div>
    <form class="row" data-form="weigh"><label class="f">面单或运单号<input name="code" autocomplete="off" /></label><button class="btn">打开包裹</button></form>
    <p class="mini">称重成功之后去做装载交接，不移入笼车。只打了面单、还没称重的，顾客订单还不是已向客户发货。</p></div>` + body +
    `<h2>已经称过的</h2>` + table(["运单", "母订单", "重量", "回写"], done.map(w => row([esc(w.waybill), esc(w.motherId), esc((w.weight || "") + " 克"), esc(w.oms || "—")])));
}
function pageStock() {
  const inStock = S.pieces.filter(onSlot);
  const scrap = S.pieces.filter(p => p.stage === "已上废品库位");
  const locRows = S.locs.filter(l => l.kind === "order").map(l => {
    const ps = S.pieces.filter(p => p.slot === l.id && onSlot(p));
    return row([
      esc(l.id), esc(l.type), badge(l.status, l.status === "占用中" ? "ok" : l.status === "已提前匹配" ? "warn" : ""),
      esc(l.motherId || "—"), esc(ps.map(p => p.id).join("、") || "—"), esc(String(ps.length)),
    ]);
  });
  const scrapRows = S.locs.filter(l => l.kind === "scrap").map(l => {
    const ps = scrap.filter(p => p.scrapSlot === l.id);
    return row([esc(l.id), "本仓废品库位，不是另一座废品仓", esc(ps.map(p => p.id).join("、") || "空"), esc(String(ps.length))], ps.length ? "bad" : "");
  });
  const occ = S.mothers.filter(mo => mo.locationId).map(mo => {
    const loc = locById(mo.locationId);
    const n = piecesOf(mo.id).filter(onSlot).length;
    return row([esc(mo.id), esc(mo.shape), esc(loc ? loc.id : mo.locationId), esc(loc ? loc.type : ""), esc(loc ? loc.status : ""), esc(String(n)), badge(motherStatus(mo))]);
  });
  const sum = bucketPieces("在库待齐").length + bucketPieces("可打波次").length + bucketPieces("超时可拆发").length + bucketPieces("待拣").length;
  const transit = S.pieces.filter(p => p.stage === "调拨在途" || p.stage === "待调出");
  const whFilter = S.stockWh || "全部";
  const whBtns = ["全部", "杭州仓", "淮安仓", "在途"].map(name => btn(name, "stock-wh", { name }, whFilter === name)).join(" ");
  const shown = S.pieces.filter(p => {
    if (whFilter === "全部") return true;
    if (whFilter === "在途") return p.stage === "调拨在途";
    return p.warehouse === whFilter && p.stage !== "调拨在途";
  });
  const pieceRows = shown.map(p => {
    const mo = motherById(p.motherId);
    const db = (S.transfers || []).find(t => t.pieceIds.includes(p.id));
    const can = p.stage === "已上架" && !p.waveId && mo && p.warehouse === mo.hub;
    return row([
      esc(p.stage === "调拨在途" ? "在途" : p.warehouse),
      esc(p.motherId), esc(p.id), badge(p.stage, p.stage === "调拨在途" || p.stage === "待调出" ? "warn" : ""),
      esc(p.slot || p.scrapSlot || p.bin || "—"),
      esc(db ? db.id + " · " + db.status : "—"),
      can ? "可以进本单波次" : "不能当可卖库存拿走",
    ], p.stage === "调拨在途" ? "" : "");
  });
  return pageHead("库位和占用", "按仓库看每一件在哪。订单仓按母订单占。调拨在途两个仓都不算在库。没有哪一件是合格了就能被任意订单拿走的。") +
    `<div class="grid">${[
      ["在库件数", inStock.length],
      ["废品库位件数", scrap.length],
      ["占用中的订单仓", S.locs.filter(l => l.kind === "order" && l.status === "占用中").length],
      ["只是提前匹配", S.locs.filter(l => l.status === "已提前匹配").length],
    ].map(([k, n]) => `<div class="stat"><b>${n}</b><span>${esc(k)}</span></div>`).join("")}</div>` +
    `<div class="oknote">在库件数 ${inStock.length}，等于看板上的在库待齐 + 可打波次 + 超时可拆发 + 待拣（${sum}）。${inStock.length === sum ? "两边对得上。" : "两边还不一致，请看件数。"} 废品不在这个加法里。待调出和调拨在途共 ${transit.length} 件，也不在这个加法里。</div>` +
    `<h2>按仓库看每一件</h2><div class="row" style="margin:8px 0">${whBtns}</div>` +
    table(["当前在哪", "母订单", "定制品 ID", "状态", "库位或盆", "调拨单", "能不能进波次"], pieceRows) +
    `<h2>订单仓库位</h2>` + table(["库位", "哪一种", "状态", "母订单", "在这格里的定制品 ID", "件数"], locRows) +
    `<h2>废品库位</h2>` + table(["库位", "说明", "定制品 ID", "件数"], scrapRows) +
    `<h2>母订单占用</h2>` + table(["母订单", "结构", "库位", "类型", "占用还是只匹配", "在库件数", "母订单状态"], occ) +
    `<p class="mini">提前匹配时货还在上架盆里，不算在库，别的母订单也不能拿走这个库位。拣完这一波该拣的货，库位才空出来。</p>`;
}
function pageTrace() {
  const q = (S.query || "").trim();
  let hitPieces = [];
  let mo = null;
  if (q) {
    const p = pieceById(q);
    if (p) { hitPieces = [p]; mo = motherById(p.motherId); }
    else if (motherById(q)) { mo = motherById(q); hitPieces = piecesOf(q); }
    else if ((S.transfers || []).some(t => t.id === q)) {
      const db = S.transfers.find(t => t.id === q);
      hitPieces = db.pieceIds.map(pieceById).filter(Boolean);
      mo = hitPieces[0] ? motherById(hitPieces[0].motherId) : null;
    }
    else {
      const w = S.waves.find(x => x.waybill === q);
      if (w) { mo = motherById(w.motherId); hitPieces = w.pieceIds.map(pieceById).filter(Boolean); }
    }
  }
  const presets = ["U-001", "U-002", "U-003", "U-088", "U-099", "U-901", "MO-10086", "MO-10087", "MO-10088", "DB-003", "WB801"].map(code => btn(code, "trace-go", { code })).join(" ");
  let detail = "";
  if (q && !hitPieces.length) detail = `<div class="badnote">没有这个定制品 ID、母订单号或运单号。</div>`;
  if (mo) {
    const loc = mo.locationId ? locById(mo.locationId) : null;
    detail += `<div class="card"><b>${esc(mo.id)}</b> · ${esc(mo.shape)} · 集货仓 ${esc(mo.hub)} · ${badge(motherStatus(mo))}<p>${esc(clockText(mo))}</p><p>订单仓：${loc ? esc(loc.id + " · " + loc.type + " · " + loc.status) : "当前没有占用"}</p><p>${mo.vas ? "增值服务：" + esc(mo.vas) + "。质检通过后先组装，再上架。" : "这张单没有增值服务，质检通过后直接进上架盆。"}</p><p>几款看子订单，件数看定制品 ID。${esc(mo.subs.map(s => s.id + " " + s.sku + " ×" + s.qty).join("；"))}</p></div>`;
  }
  hitPieces.forEach(p => {
    const events = p.events.map(e => row([esc(e.t), esc(e.step), esc(e.who), esc(e.status), esc(e.text)]));
    const photos = (p.qc && p.qc.photos) || [];
    const w = waveOfPiece(p);
    const db = (S.transfers || []).find(t => t.pieceIds.includes(p.id));
    detail += `<h2>${esc(p.id)} · ${esc(p.name)} · ${badge(p.stage, failed(p) ? "bad" : "ok")}</h2>` +
      `<p class="mini">子订单 ${esc(p.subId)} · 母订单 ${esc(p.motherId)} · 当前仓库 ${esc(p.stage === "调拨在途" ? "在途" : p.warehouse)} · 怎么到集货仓 ${esc(p.via || "—")} · 订单仓 ${esc(p.slot || "没有")} · 废品库位 ${esc(p.scrapSlot || "没有")} · 波次 ${esc(p.waveId || "没有")}</p>` +
      (db ? `<p>调拨单 ${esc(db.id)}：${esc(db.from)} → ${esc(db.to)} · ${badge(db.status, db.status === "调入完成" ? "ok" : "warn")}。这不是顾客面单。</p>` : "") +
      (p.qc ? `<p>质检：${esc(p.qc.result)} ${esc(p.qc.reason || "")} · 尺寸 ${esc(p.qc.size || "—")} · 颜色 ${esc(p.qc.color || "—")} · 材质 ${esc(p.qc.material || "—")}</p>` : "<p>还没有质检记录。</p>") +
      (photos.length ? `<p>质检照片：${photos.map(f => esc(f.name) + "（" + f.status + "）").join("、")}</p>` : "") +
      (p.qc && p.qc.video ? `<p>质检视频：${esc(p.qc.video.name)}（${esc(p.qc.video.status)}）</p>` : `<p class="mini">${p.highValue ? "高价值，还没有质检视频。" : "不是高价值，不要求质检视频。"}</p>`) +
      (w && w.packVideo ? `<p>打包视频：${esc(w.packVideo.name)}（${esc(w.packVideo.status)}）。这和质检视频不是同一个文件。</p>` : "") +
      (w ? `<p>波次 ${esc(w.id)} · ${esc(w.kind)} · ${esc(w.mode)} · 来源 ${esc(w.source)} · 面单 ${esc(w.waybill || "未打")} ${w.stopped ? "· 旧面单已停止" : ""} ${w.weightOk ? "· " + w.weight + " 克 · " + w.oms : ""}</p>` : "") +
      table(["时间", "哪一步", "谁", "当时状态", "记录"], events);
  });
  const badScan = table(["时间", "岗位", "扫到", "为什么拒绝"], S.anomalies.slice(0, 8).map(a => row([esc(a.t), esc(a.who), esc(a.code), esc(a.why)])));
  return pageHead("按件或按单查", "查这一件经过收货、调拨、质检、组装、库位、波次、拣货、复核、称重。不通过和废品库位留在同一条记录里。") +
    `<div class="card"><div class="row">${presets}</div>
    <form class="row" data-form="trace"><label class="f">定制品 ID、母订单号或运单号<input name="code" value="${esc(S.query)}" /></label><button class="btn primary">查</button></form>
    ${btn("模拟夜间上传（仅演练）", "night")}<p class="mini">正式环境只在 00:00 到 05:00 把质检照片、高价值质检视频、打包视频拷到仓库本地服务器。传没传完，都不改出库。</p></div>` +
    detail + `<h2>没扫成的码</h2>` + badScan;
}

function pageTransfer() {
  const rows = (S.transfers || []).map(t => {
    const pcs = t.pieceIds.map(pieceById).filter(Boolean);
    const mo = pcs[0] ? motherById(pcs[0].motherId) : null;
    return row([
      esc(t.id), esc(t.from), esc(t.to), esc(mo ? mo.id : "—"),
      esc(pcs.map(p => p.id + " " + (p.stage === "调拨在途" ? "在途" : p.warehouse) + " " + p.stage).join("；")),
      badge(t.status, t.status === "调入完成" ? "ok" : "warn"),
      t.status === "待主管确认" ? btn("主管确认这张调拨单", "transfer-ok", { id: t.id }, true) : "",
    ]);
  });
  const actionable = S.pieces.filter(p => ["待调出", "调拨在途"].includes(p.stage));
  const chips = actionable.map(p => btn(
    (p.stage === "待调出" ? "在" + p.warehouse + "扫出 " : "在集货仓扫入 ") + p.id,
    p.stage === "待调出" ? "transfer-out" : "transfer-in",
    { code: p.id },
    true,
  )).join(" ");
  return pageHead("调拨", "货不在集货仓时，主管先确认调拨单。调拨员在调出仓扫出，到集货仓再扫入。调拨单不能拿去给顾客打面单。") +
    `<div class="card"><p>下面的按钮就是演练用的扫码。调出之后，这件变成调拨在途，杭州和淮安都不算在库，也不能进顾客波次。</p><div class="row" style="margin:8px 0">${chips || "<span class='mini'>现在没有待调出或在途的件。</span>"}</div>
    <form class="row" data-form="transfer"><label class="f">或输入定制品 ID<input name="code" autocomplete="off" placeholder="例如 U-003" /></label><button class="btn primary">按当前状态扫出或扫入</button></form>
    <div class="row">${btn("用调拨单号打顾客面单", "transfer-print")} ${btn("把 U-003 调进一个不是集货仓的仓库", "transfer-wrong")}</div>
    <p class="mini">培训路径：先换仓库主管确认 DB-003，再换调拨员扫出、扫入。扫入之后去质检，不要再在收货屏收一次。</p></div>` +
    table(["调拨单", "调出仓", "调入仓", "母订单", "定制品 ID", "状态", ""], rows);
}
function pageGather() {
  const rows = S.mothers.map(mo => {
    const ps = piecesOf(mo.id);
    const notHere = (p) => ["待收货", "待调出", "调拨在途"].includes(p.stage);
    const got = ps.filter(p => !notHere(p));
    const lack = ps.filter(notHere);
    return row([
      esc(mo.hub), esc(mo.id), esc(mo.shape),
      esc(got.length + " / " + ps.length),
      esc(lack.map(p => p.id + "（" + p.stage + "）").join("、") || "没有了"),
      esc(ps.map(p => p.id + "：" + (p.via || "—")).join("；")),
      badge(motherStatus(mo)),
    ]);
  });
  return pageHead("集货合单", "集货仓按母订单等齐。同一张母订单分几次到的件，系统合成这一张单的清单。人只核对，不手建第二张母订单。") +
    `<div class="card"><p>应收件数是下单时就定好的。调拨调入或本仓收货，都只是把已有的定制品 ID 合进这张清单，不会把应收再加一遍。两张母订单不能并成一个顾客包裹。72 小时只在集货仓、第一件上架成功占用库位之后才开始。</p>
    ${btn("把 MO-10086 和 MO-10087 合成一个顾客包裹", "gather-merge")}</div>` +
    table(["集货仓", "母订单", "结构", "已到/应收", "还缺", "每件怎么来的", "母订单"], rows);
}
function pageAssemble() {
  const waiting = S.pieces.filter(p => p.stage === "待组装");
  const groups = {};
  waiting.forEach(p => { (groups[p.motherId] = groups[p.motherId] || []).push(p); });
  const cards = Object.keys(groups).map(id => {
    const mo = motherById(id);
    const scanned = S.asm && S.asm.motherId === id ? S.asm.scanned : [];
    const lines = groups[id].map(p => {
      const done = scanned.includes(p.id);
      return `<div class="row" style="margin:6px 0">${esc(p.id)} · ${esc(p.name)} ${done ? badge("已扫", "ok") : badge("未扫", "warn")} ${done ? "" : btn("当作扫到 " + p.id, "asm-scan", { code: p.id }, true)}</div>`;
    }).join("");
    const all = groups[id].every(p => scanned.includes(p.id));
    return `<div class="card"><b>${esc(mo.id)}</b> · 集货仓 ${esc(mo.hub)} · 增值服务：${esc(mo.vas || "没有")}<p class="mini">质检已通过，还没进上架盆。少扫一件不能完成。同款多件如果订单没带增值服务，不会出现在这里。</p>${lines}${all ? btn("组装完成", "asm-done", { id: mo.id }, true) : `<p class="mini">还没扫齐，完成按钮先不出现。</p>`}</div>`;
  }).join("");
  return pageHead("组装加工", "只在集货仓。质检已通过、订单带了增值服务、还没进上架盆。逐件扫定制品 ID，做完才交给上架。") +
    (cards || `<div class="card">现在没有待组装的件。没带增值服务的单不会出现在这里。培训路径先收 U-088，质检通过后再来。</div>`) +
    `<form class="row" data-form="assemble"><label class="f">定制品 ID<input name="code" autocomplete="off" placeholder="例如 U-088" /></label><button class="btn">扫这个码</button></form>` +
    `<p class="mini">组装完成之后，状态变成质检通过待上架。这一步仍不算在库，72 小时要等上架四步做完才开始。</p>`;
}

function pageSlots() {
  const rows = S.locs.filter(l => l.kind === "order").map(l => {
    const mo = l.motherId ? motherById(l.motherId) : null;
    const here = mo ? piecesOf(mo.id).filter(p => p.slot === l.id) : [];
    const missing = mo ? piecesOf(mo.id).filter(p => p.slot !== l.id && p.stage !== "已出库称重" && !failed(p)) : [];
    const word = !mo ? "空闲" : (missing.length ? "还缺件" : l.status);
    return row([
      esc(l.id), esc(l.type), badge(word, word === "空闲" ? "ok" : "warn"),
      esc(mo ? mo.id + " · " + mo.shape : "—"),
      esc(here.map(p => p.id).join("、") || "—"),
      esc(missing.map(p => p.id + "（" + p.stage + "）").join("、") || "没有了"),
    ]);
  });
  return pageHead("订单库位", "一个格子同一时间只挂一张母订单。还缺的是这张单自己的定制品 ID，不是拿同款别的货来顶。") +
    `<div class="card"><p>空闲的格子不挂母订单。货还在上架盆里时，库位只是提前匹配，那一件还不算占在格子里。拣完这一波该拣的货，格子才空出来给下一张单。</p></div>` +
    table(["库位", "哪一种", "现在", "母订单", "已经在这格的定制品 ID", "还缺"], rows);
}
function pageCheck() {
  const locs = S.locs.filter(l => l.kind === "order" && l.motherId);
  const slot = S.checkSlot && locById(S.checkSlot) ? S.checkSlot : (locs[0] ? locs[0].id : "");
  const loc = slot ? locById(slot) : null;
  const book = loc ? S.pieces.filter(p => p.slot === loc.id) : [];
  const chips = locs.map(l => btn(l.id + " · " + l.motherId, "check-slot", { id: l.id }, l.id === slot)).join(" ");
  const seen = book.map(p => btn("当作看到 " + p.id, "check-seen", { code: p.id, slot }, true)).join(" ");
  const rows = (S.checks || []).map(c => row([
    esc(c.t), esc(c.slot), esc(c.book), esc(c.seen), badge(c.result, c.result.indexOf("对不上") >= 0 ? "warn" : "ok"), esc(c.who),
  ]));
  return pageHead("库位核对", "仓库主管对一下格子里看到的定制品 ID，是不是账面这一张母订单的这一件。对不上只记下来。") +
    `<div class="card"><p>先选库位。账面列出现在占着这一格的定制品 ID。看到别的码，也只记一笔，货不会因此改状态，也不会变成谁都能拿走的库存。</p>
    <div class="row" style="margin:8px 0">${chips || "<span class='mini'>现在没有挂着母订单的订单库位。</span>"}</div>
    <p>账面：${esc(book.map(p => p.id).join("、") || "这一格账面是空的")}</p>
    <div class="row">${seen} ${btn("当作看到一个不属于这格的码", "check-seen", { code: "U-别处", slot })}</div></div>` +
    table(["时间", "库位", "账面", "看到的", "结果", "谁"], rows);
}
function pageLogs() {
  const rows = S.logs.map(l => row([esc(l.t), esc(l.who), esc(l.step), esc(l.id || "—"), esc(l.motherId || "—"), esc(l.text)]));
  return pageHead("作业日志", "按时间看谁做了哪一步。订单中台改状态的那一行也在这里。这一屏只查。") +
    table(["时间", "谁", "哪一步", "定制品 ID", "母订单", "记录"], rows);
}
function pageWaybill() {
  const rows = S.waves.filter(w => w.printed).map(w => row([
    esc(w.waybill), esc((w.prev || []).join("、") || "—"), esc(w.motherId), esc(w.kind), badge(w.status, w.weightOk ? "ok" : "warn"),
    w.weightOk || w.stopped ? "不能在这里换" : btn("按原号再打一张", "bill-reprint", { id: w.id }) + " " + btn("请中台重取新号", "bill-replace", { id: w.id }, true),
  ]));
  return pageHead("面单", "面单已经打出、包裹还没称重时，拣货员可以按原号再打，或请订单中台重取新号。仓库不改收件地址。") +
    `<div class="card"><p>补打和换号都不写成已向客户发货。已经称重的单停在出库结果上，不在这里换号。已经停止的旧波次，走异常订单处理专员的新波次，不在这里复活。</p>
    <p class="mini">货品标签只印工厂已经给过的定制品 ID，仓库不另编一个码。</p>
    <form class="row" data-form="label"><label class="f">定制品 ID<input name="code" autocomplete="off" placeholder="例如 U-501" /></label><button class="btn">打印这件的标签</button></form>
    ${S.label ? `<p>标签内容：<b>${esc(S.label)}</b>。这是原来的定制品 ID。</p>` : ""}</div>` +
    table(["当前面单", "已停止的旧号", "母订单", "件数类", "状态", ""], rows);
}

function pageOne() { S.reviewWhich = "单件"; return pagePack(); }
function pageMany() { S.reviewWhich = "多件"; return pagePack(); }

function pagePost() {
  const open = unfinishedBoxes();
  const rows = (S.boxes || []).map(b => {
    const lines = b.lines.map(l => l.id + " 清单 " + l.expect + " / 清点 " + (l.actual == null ? "还没点" : l.actual)).join("；");
    const left = b.lines.filter(l => { const p = pieceById(l.id); return p && p.stage === "待收货"; }).map(l => l.id);
    const word = b.diff ? "件数对不上" : (b.ok ? (left.length ? "当日到货未收完" : "已收完") : "还没清点");
    return row([esc(b.express), esc(b.id), esc(b.supplier), esc(b.motherId), esc(lines), badge(word, b.ok && !left.length ? "ok" : "warn"), btn("打开这箱", "post-open", { code: b.express })]);
  });
  const cur = S.postBox ? boxOpen(S.postBox) : null;
  let detail = "";
  if (cur) {
    const lineBtns = cur.lines.map(l => btn("清点 " + l.id + " 为 " + l.expect + " 件", "post-line", { express: cur.express, id: l.id, qty: String(l.expect) }, true)).join(" ");
    detail = `<div class="card"><b>集货快递 ${esc(cur.express)}</b> 对上到货单 ${esc(cur.id)} · 供应商 ${esc(cur.supplier)} · 母订单 ${esc(cur.motherId)}
      <p>${cur.lines.map(l => esc(l.id) + "：供应商清单 " + l.expect + " 件，已点 " + (l.actual == null ? "—" : l.actual) + " 件").join("<br>")}</p>
      <div class="row">${lineBtns}</div>
      <div class="row" style="margin-top:8px">${btn("按清单把这一箱点齐", "post-match", { express: cur.express }, true)} ${btn("故意少点一件", "post-short", { express: cur.express })}</div>
      <p class="mini">${cur.ok ? "件数对上了。请去收货，扫定制品 ID，扫一次只收一件。" : "对不上或还没点完时，不能把没点到的件写成已收货。"}</p></div>`;
  }
  const late = open.filter(b => b.ok || b.lines.some(l => l.actual != null));
  return pageHead("小邮局", "到货。按供应商发给仓库的集货快递单号，对上到货单，清点箱里每个定制品 ID 的件数。") +
    `<div class="card"><p>收货截单时间现在是 <b>${esc(S.cutoff)}</b>。截单前到的集货快递箱，当天要把箱里每个定制品 ID 收完。这个钟点由仓库主管改，演示不写死成唯一的下班时间。</p>
    <form class="row" data-form="cutoff"><label class="f">截单时间<input name="code" value="${esc(S.cutoff)}" placeholder="16:00" /></label><button class="btn">仓库主管保存</button></form>
    <form class="row" data-form="post"><label class="f">集货快递单号<input name="code" autocomplete="off" placeholder="例如 SF86001" /></label><button class="btn primary">对上到货单</button></form>
    ${late.length ? `<div class="note">当日到货未收完：${esc(late.map(b => b.express).join("、"))}。没扫的件不能拿去质检。</div>` : ""}</div>` +
    detail + table(["集货快递单号", "到货单", "供应商", "母订单", "每个定制品 ID", "进度", ""], rows);
}

function rebinEligible(w) {
  return !!(w && w.printed && !w.stopped && w.pieceIds.length >= 2 && ["待打包", "待二次分拣"].includes(w.status));
}
function pageRebin() {
  const waves = S.waves.filter(rebinEligible);
  const chips = waves.map(w => btn("当作扫到面单 " + w.waybill + "（" + w.motherId + "）", "rebin-bill", { code: w.waybill })).join(" ");
  let body = "";
  if (S.rebin && waveById(S.rebin)) {
    const w = waveById(S.rebin);
    const sorted = w.sorted || [];
    const rows = w.pieceIds.map(id => {
      const p = pieceById(id);
      const done = sorted.includes(id);
      return row([esc(id), esc(p.name), esc(w.motherId), done ? badge("已汇上这张面单", "ok") : badge("未汇", "warn"), done ? "" : btn("当作扫到 " + id, "rebin-item", { code: id }, true)], done ? "ok" : "");
    });
    const gathered = w.pieceIds.every(id => sorted.includes(id));
    body = `<div class="card"><p>面单 ${esc(w.waybill)} 只属于母订单 ${esc(w.motherId)}。别的母订单的货不能放进来。</p>
      <p class="mini">${gathered ? "这一张面单上的件已经归拢。多件复核不靠这一步才能打开。" : "归拢这一张面单上的件。多件复核可以同时打开，不必等这里汇齐。"}</p></div>` + table(["定制品 ID", "商品", "母订单", "这一步", ""], rows);
  }
  return pageHead("二次分拣", "单独一屏。拣货员需要把同一张母订单、同一张面单上的多件再归到一处时用。") +
    `<div class="card"><p>一单多件拣完可以直接去多件复核。这里不挡住那一屏。单件不会出现。</p><div class="row">${chips || "<span class='mini'>现在没有可以归拢的多件面单。要先按面单把多件拣完。拣完也可以直接去多件复核。</span>"}</div>
    <form class="row" data-form="rebin"><label class="f">面单或定制品 ID<input name="code" autocomplete="off" /></label><button class="btn primary">扫这个码</button></form>
    ${btn("按收件人把两张母订单合成一张面单", "rebin-merge")}</div>` + body;
}

function pageLoad() {
  const wait = S.waves.filter(w => w.weightOk && !w.handover && !w.stopped);
  const done = S.waves.filter(w => w.handover);
  const rows = wait.map(w => row([esc(w.waybill), esc(w.motherId), esc((w.weight || "") + " 克"), badge("已称重，待交接", "warn"), btn("装载交接", "handover", { id: w.id }, true)]));
  const list = done.map(w => row([esc(w.handoverAt || ""), esc(w.waybill), esc(w.motherId), esc(w.pieceIds.length + " 件"), esc((w.weight || "") + " 克")]));
  return pageHead("装载交接", "称重完成之后不移入笼车，直接交接。系统打出当日交接清单。") +
    `<div class="card"><p>只交接称重成功的包裹。重量有差异也不把这一包拦在清单外面。没称重的运单不会出现在下面。</p>${btn("打出当日交接清单", "handover-list", {}, true)}</div>` +
    table(["运单", "母订单", "重量", "状态", ""], rows) +
    (S.showList ? `<h2>当日交接清单</h2>` + (list.length ? table(["交接时间", "运单", "母订单", "件数", "重量"], list) : `<div class="note">今天还没有已交接的包裹。</div>`) : "");
}

function pageFactory() {
  const waiting = S.pieces.filter(p => p.stage === "待工厂复核");
  const groups = {};
  waiting.forEach(p => { (groups[p.motherId] = groups[p.motherId] || []).push(p); });
  const cards = Object.keys(groups).map(id => {
    const mo = motherById(id);
    const ps = groups[id];
    const single = ps.length === 1 && piecesOf(id).length === 1;
    const scanned = S.factoryScan && S.factoryScan.motherId === id ? S.factoryScan.ids : [];
    const lines = ps.map(p => {
      const done = scanned.includes(p.id);
      return `<div class="row" style="margin:6px 0">${esc(p.id)} · ${esc(p.name)} ${done ? badge("已复核", "ok") : badge("未扫", "warn")} ${done ? "" : btn("当作扫到 " + p.id, "factory-scan", { code: p.id }, true)}</div>`;
    }).join("");
    const all = ps.every(p => scanned.includes(p.id));
    const reason = ps.map(p => p.exception).find(Boolean);
    let act = `<p class="mini">${single ? "先扫这一件。" : "多件要逐件扫完。同款和多款都在这一套。"}</p>`;
    if (all && reason) act = btn("发不出去，转到杭州（" + reason + "）", "factory-hub", { id }, true);
    else if (all) {
      act = btn("复核通过，在淮安直发", "factory-ship", { id }, true);
      if (!single) act += " " + btn("因为是多件，改送到杭州", "factory-hub", { id });
    }
    const note = reason
      ? "原因是" + reason + "。转到杭州之后仍要质检、上架。72 小时不从淮安起算。不打顾客面单。"
      : "复核后在淮安直发。不进杭州质检和上架，72 小时不从淮安起算。";
    return `<div class="card"><b>${esc(mo.id)}</b> · ${esc(single ? "淮安工厂单件复核" : "淮安工厂多件复核")} · ${esc(reason ? "发不出去" : "在淮安直发")}<p class="mini">${esc(note)}</p>${lines}${act}</div>`;
  }).join("");
  return pageHead("淮安复核", "一件和多件都可以在淮安复核后直发。只有超尺寸、物流渠道到不了、地址或国家有问题，才转到杭州。") +
    (cards || `<div class="card">现在没有待工厂复核的件。</div>`) +
    `<p class="mini">直发的去称重。称重成功才回写已向客户发货。打面单当时还不是已向客户发货。</p>`;
}

function frameNote(text) {
  return `<div class="note">${esc(text)} 这一页能打开，能看出以后记在哪。不作为从收货到称重的验收，也不能把货改成可卖库存。</div>`;
}
function pageMove() {
  const rows = (S.moves || []).map(m => row([esc(m.t), esc(m.from), esc(m.to), esc(m.who), esc(m.text)]));
  return pageHead("移库（框架）", "本期只演示这一页能记一笔。货的状态不在这里改。") +
    frameNote("库位主数据维护仍不做。") +
    `<form class="card row" data-form="move"><label class="f">从<input name="from" placeholder="OC-07" /></label><label class="f">到<input name="to" placeholder="OC-11" /></label><button class="btn primary">记下移库</button></form>` +
    table(["时间", "从", "到", "谁", "记录"], rows);
}
function pageSpecial() {
  const rows = (S.specials || []).map(s => row([esc(s.t), esc(s.reason), esc(s.qty), badge("只送审，未入库", "warn"), esc(s.who)]));
  return pageHead("特殊入库（框架）", "错发、盘盈先记一笔。主路径的工厂到货仍走小邮局和收货。") +
    frameNote("送审通过后也不能进可卖库存，不能跳过质检。") +
    `<form class="card row" data-form="special"><label class="f">原因<input name="code" placeholder="盘盈" /></label><button class="btn primary">送审</button></form>` +
    table(["时间", "原因", "数量", "状态", "谁"], rows);
}
function pageReturns() {
  const rows = (S.returns || []).map(r => row([esc(r.t), esc(r.id), badge(r.result, "warn"), esc(r.who)]));
  return pageHead("退货（框架）", "先记退货这一笔。不能把废品改判成合格。") +
    frameNote("退货页不代替收货、质检、上架。") +
    `<div class="card"><div class="row">${btn("当作扫到废品 U-901", "return-scan", { code: "U-901" })} ${btn("当作扫到在库的 U-201", "return-scan", { code: "U-201" })}</div></div>` +
    table(["时间", "定制品 ID", "记下什么", "谁"], rows);
}
function pageHours() {
  const map = {};
  S.logs.forEach(l => { map[l.who] = (map[l.who] || 0) + 1; });
  const rows = Object.keys(map).map(who => row([esc(who), esc(String(map[who])), "只统计演示里点过的步骤，不算工资"]));
  return pageHead("工时及考勤（框架）", "能看出哪个岗位今天动过手。这里不算工资，也不改货。") +
    frameNote("工时只做框架。") + table(["岗位或人", "演示里的步骤次数", "说明"], rows);
}
function pageAccounts() {
  const roles = ["收货员", "质检员", "上架员", "拣货员", "打包员", "发货员", "异常订单处理专员", "调拨员", "组装员", "仓库主管", "仓库管理员"];
  const rows = roles.map(role => {
    const pages = role === "仓库管理员" ? "可以代各岗点" : Object.keys(POSTS).filter(k => POSTS[k].includes(role)).join("、");
    return row([esc(role), esc(pages || "这一版没有单独按钮")]);
  });
  return pageHead("角色账号及权限（框架）", "看每个岗位能做哪一类动作。演练时右上角换岗位。仓库管理员可以代点，屏幕上仍写这一步该谁做。") +
    frameNote("不在这一页把货改状态。") + table(["岗位", "可以做的动作"], rows);
}

const PAGES = {
  kanban: pageKanban, sim: pageSim, post: pagePost, receive: pageReceive, transfer: pageTransfer, gather: pageGather, qc: pageQc, assemble: pageAssemble, putaway: pagePutaway,
  wave: pageWave, pick: pagePick, rebin: pageRebin, one: pageOne, many: pageMany, pack: pageMany, weigh: pageWeigh, load: pageLoad, waybill: pageWaybill, factory: pageFactory,
  move: pageMove, special: pageSpecial, returns: pageReturns,
  stock: pageStock, slots: pageSlots, check: pageCheck, trace: pageTrace, logs: pageLogs, hours: pageHours, accounts: pageAccounts,
};

function renderNav() {
  document.getElementById("nav").innerHTML = NAV.map(([group, items]) => `
    <div class="group"><button type="button">${esc(group)}</button>
      ${items.map(([id, name]) => `<button type="button" class="item ${S.page === id ? "on" : ""}" data-act="goto" data-page="${id}">${esc(name)}</button>`).join("")}
    </div>`).join("");
}
function render() {
  renderNav();
  const fn = PAGES[S.page] || pageKanban;
  document.getElementById("main").innerHTML = fn().replace("</p>", "</p>" + jobBox() + resultBox());
  const role = document.getElementById("role");
  if (role) role.value = S.role;
  const channel = document.getElementById("channel");
  if (channel && S.channel) channel.value = S.channel;
  syncAlarm();
}
function syncAlarm() {
  const on = S.pack && S.pack.alarm && (S.page === "pack" || S.page === "one" || S.page === "many");
  if (on && !syncAlarm.t) syncAlarm.t = setInterval(() => beep(1), 3000);
  if (!on && syncAlarm.t) { clearInterval(syncAlarm.t); syncAlarm.t = null; }
}
function beep(times) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    let t = ctx.currentTime;
    for (let i = 0; i < times; i++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = times > 1 ? 220 : 660;
      g.gain.setValueAtTime(0.04, t);
      o.start(t); o.stop(t + 0.12);
      t += 0.18;
    }
  } catch (e) { /* 静音时仍靠红字 */ }
}

function doReceive(code) {
  if (!need("receive")) return;
  const p = pieceById(code);
  if (!p) {
    anomaly(code || "空码", "扫不到母订单，不能收");
    say("bad", "扫不到母订单，不能收。货放一边，交主管。");
    return render();
  }
  const mo0 = motherById(p.motherId);
  if (mo0 && (p.warehouse !== mo0.hub || ["待调出", "调拨在途"].includes(p.stage))) {
    anomaly(code, "不在集货仓");
    say("bad", p.id + " 现在在" + p.warehouse + "，集货仓是" + mo0.hub + "。请走调拨，不要在这里收成已收货。72 小时也不从这里起算。");
    goNext("transfer", "去调拨（下一屏：调拨员）");
    return render();
  }
  const box = boxOfPiece(p.id);
  if (box && !box.ok) {
    anomaly(code, "小邮局还没清点");
    say("bad", "先到小邮局清点集货快递 " + box.express + "，对上到货单 " + box.id + "。件数没对上，不能收成已收货。");
    goNext("post", "去小邮局（下一屏：收货员）");
    return render();
  }
  if (p.stage !== "待收货") {
    anomaly(code, "重复收货");
    say("bad", "这件已在「" + p.stage + "」，不要重复收。请送到对应岗位。");
    return render();
  }
  p.stage = "已收货待质检";
  p.warehouse = mo0.hub;
  p.via = "本仓收货";
  S.recvUndo = { id: p.id, at: Date.now() };
  addEvent(p, "收货员", "收货", "在集货仓 " + mo0.hub + " 收货成功。属于 " + p.motherId + " / " + p.subId + "。已和这张母订单的清单合在一起。不占订单仓，不启动 72 小时。");
  const mo = motherById(p.motherId);
  const lack = piecesOf(mo.id).filter(x => x.stage === "待收货").map(x => x.id);
  const sub = subOf(p);
  const gotSub = piecesOf(mo.id).filter(x => x.subId === p.subId && x.stage !== "待收货").length;
  say("ok", "收货成功。扫一次只收 " + p.id + " 这一件。子订单 " + p.subId + " 应有 " + (sub ? sub.qty : 1) + " 件，现在收到 " + gotSub + " 件。母订单 " + recvSummary(mo));
  S.focus = mo.id;
  if (lack.length) goNext("receive", "同一张单还有 " + lack.join("、") + "，继续收");
  else goNext("qc", "去质检（下一屏：质检员）");
  beep(1);
  render();
}
function openQc(code) {
  const p = pieceById(code);
  if (!p) {
    anomaly(code, "码不存在");
    say("bad", "没有这个定制品 ID，不建质检记录。");
    return render();
  }
  if (p.stage === "待收货") {
    say("bad", "这件还没收货，不能在质检屏补收。请收货员先扫。");
    return render();
  }
  if (p.stage === "质检不通过") {
    S.qc = { id: p.id };
    S.scrap = { idOk: false };
    S.page = "qc";
    return render();
  }
  if (p.stage === "已上废品库位" || (p.qc && p.qc.result === "通过")) {
    S.qc = { id: p.id, photo: true, video: !!(p.qc && p.qc.video), size: p.qc ? p.qc.size : "", color: p.qc ? p.qc.color : "", material: p.qc ? p.qc.material : "" };
    say("ok", p.stage === "已上废品库位" ? "打开原记录。不能改判通过。" : "这件已经质检通过（" + (p.qc.at || "") + "）。不重复通过。");
    return render();
  }
  if (p.stage !== "已收货待质检") {
    say("bad", "这一件当前是「" + p.stage + "」，不用再质检。");
    return render();
  }
  S.qc = { id: p.id, photo: false, video: false, manual: false, size: "", color: "", material: "", weightNote: "" };
  S.page = "qc";
  render();
}
function readQcFields() {
  const size = document.getElementById("qc-size");
  const color = document.getElementById("qc-color");
  const material = document.getElementById("qc-material");
  if (!S.qc) return;
  if (size) S.qc.size = size.value.trim();
  if (color) S.qc.color = color.value.trim();
  if (material) S.qc.material = material.value.trim();
}
function qcReady(p) {
  if (!S.qc || !S.qc.photo) return "少照片，不能提交通过，也不能提交不通过。";
  if (p.highValue && !S.qc.video) return "这件是高价值，还没有质检视频，不能提交。";
  if (!(S.qc.size && S.qc.color && S.qc.material)) return "尺寸、颜色、材质还空着。识别失败时要手填完整，才可以由人点通过。";
  return "";
}
function qcPass() {
  if (!need("qc")) return;
  readQcFields();
  const p = pieceById(S.qc && S.qc.id);
  if (!p || p.stage !== "已收货待质检") return say("bad", "先扫一件待质检的定制品 ID。");
  const why = qcReady(p);
  if (why) { say("bad", why); return render(); }
  const mo = motherById(p.motherId);
  const qcRec = { result: "通过", reason: "", size: S.qc.size, color: S.qc.color, material: S.qc.material, photos: [{ name: p.id + "-照片", kind: "质检照片", status: "在系统服务器" }], video: S.qc.video ? { name: p.id + "-质检视频", kind: "质检视频", status: "在系统服务器" } : "", weight: S.qc.weight || "", at: now(), who: "质检员" };
  if (mo.vas) {
    p.qc = qcRec;
    p.stage = "待组装";
    p.bin = "";
    addEvent(p, "质检员", "质检", "质检通过。这张单带了增值服务「" + mo.vas + "」。先去组装工位，不进上架盆，不算在库，72 小时不从这一下起算。");
    say("ok", "质检通过。订单带了「" + mo.vas + "」，状态变成待组装。先不要放进上架盆，也不要去订单仓。72 小时还没开始。");
    goNext("assemble", "去组装（下一屏：组装员）");
    beep(1);
    return render();
  }
  const loc = matchLocation(mo);
  if (!loc) { say("bad", "没有装得下的空库位。先不要记成已上架。"); return render(); }
  const bin = assignBin(mo);
  p.qc = qcRec;
  p.stage = "质检通过待上架";
  p.bin = bin.id;
  bin.pieceIds.push(p.id);
  addEvent(p, "质检员", "质检", "质检通过。放入上架盆 " + bin.id + "。库位 " + loc.id + " 只是提前匹配，还不算在库，72 小时不从这一下起算。");
  say("ok", "放入上架盆 " + bin.id + "。母订单 " + mo.id + "。不要直接送去订单仓 " + loc.id + "。状态变成质检通过待上架。72 小时还没开始。");
  const more = piecesOf(mo.id).some(x => x.stage === "已收货待质检");
  goNext(more ? "qc" : "putaway", more ? "这张单还有件待质检" : "去上架（下一屏：上架员）");
  beep(1);
  render();
}
function qcFail() {
  if (!need("qc")) return;
  readQcFields();
  const p = pieceById(S.qc && S.qc.id);
  if (!p || p.stage !== "已收货待质检") return say("bad", "先扫一件待质检的定制品 ID。");
  if (!S.qc.photo) { say("bad", "少照片，不能提交不通过。"); return render(); }
  if (p.highValue && !S.qc.video) { say("bad", "高价值还没有质检视频，不能提交。"); return render(); }
  const reasonEl = document.getElementById("qc-reason");
  const reason = reasonEl ? reasonEl.value : "破损";
  const scrap = S.locs.find(l => l.kind === "scrap" && l.status === "空闲") || S.locs.find(l => l.kind === "scrap");
  p.stage = "质检不通过";
  p.scrapTarget = scrap.id;
  p.qc = { result: "不通过", reason, size: S.qc.size, color: S.qc.color, material: S.qc.material, photos: [{ name: p.id + "-照片", kind: "质检照片", status: "在系统服务器" }], video: S.qc.video ? { name: p.id + "-质检视频", kind: "质检视频", status: "在系统服务器" } : "", weight: "", at: now(), who: "质检员" };
  S.scrap = { idOk: false };
  addEvent(p, "质检员", "质检", "质检不通过（" + reason + "）。照片保留。请扫上废品库位 " + scrap.id + "。不进上架盆，不启动 72 小时。");
  say("bad", "不要放入合格品上架盆。照片已保留，准备报废。下一屏仍是质检员：扫 " + p.id + "，再扫废品库位 " + scrap.id + "。");
  beep(2);
  render();
}
function scrapId(code) {
  if (!need("scrap")) return;
  const p = pieceById(code);
  if (!p || p.stage !== "质检不通过") { say("bad", "先对质检不通过的那一件扫定制品 ID。"); return render(); }
  S.scrap = { idOk: true, id: p.id };
  S.qc = { id: p.id };
  say("ok", "已确认是 " + p.id + "。再扫废品库位 " + p.scrapTarget + "。");
  render();
}
function scrapLoc(code) {
  if (!need("scrap")) return;
  const p = S.qc && pieceById(S.qc.id);
  if (!p || p.stage !== "质检不通过") return say("bad", "没有等待上废品库位的件。");
  if (!S.scrap || !S.scrap.idOk) { say("bad", "先扫定制品 ID " + p.id + "，再扫废品库位。"); return render(); }
  if (code !== p.scrapTarget) { say("bad", "这不是这件货要去的废品库位。请扫 " + p.scrapTarget + "。"); return render(); }
  p.stage = "已上废品库位";
  p.scrapSlot = code;
  const loc = locById(code);
  if (loc) loc.status = "在用";
  addEvent(p, "质检员", "废品库位", "已扫上本仓废品库位 " + code + "。不占订单仓，不进波次，不能发给买家。");
  say("bad", "已上废品库位 " + code + "。状态变成已上废品库位。订单侧可以看原单重做或取消退款，仓员不代选。");
  S.next = null;
  beep(1);
  render();
}
function orderRedo(id) {
  const p = pieceById(id);
  if (!p || p.stage !== "已上废品库位") return say("bad", "货还没在废品库位，订单侧先不选。");
  if (p.orderSide) return say("ok", "订单侧已经选过：" + p.orderSide + "。");
  const neu = nextId("U-N");
  p.orderSide = "原订单重做";
  p.redoId = neu;
  const np = piece({ id: neu, motherId: p.motherId, subId: p.subId, sku: p.sku, name: p.name, spec: "工厂新做的一件", highValue: p.highValue, expect: p.expect, stage: "待收货" });
  S.pieces.push(np);
  addEvent(p, "订单中台", "订单侧", "原订单重做。原订单号不变。新定制品 ID " + neu + " 待收货。旧件仍在废品库位。");
  addEvent(np, "订单中台", "订单侧", "这是原订单重做的新定制品 ID，等收货员再收、再质检。");
  say("ok", "原订单号 " + p.motherId + " 不变。新定制品 ID " + neu + " 已交给收货。旧件留在 " + p.scrapSlot + "。仓库没有把废品改码重发。");
  render();
}
function orderCancel(id) {
  const p = pieceById(id);
  if (!p || p.stage !== "已上废品库位") return say("bad", "货还没在废品库位，订单侧先不选。");
  if (p.orderSide) return say("ok", "订单侧已经选过：" + p.orderSide + "。");
  p.orderSide = "取消并退款";
  addEvent(p, "订单中台", "订单侧", "取消并退款。退款在订单中台做。仓库只确认货在废品库位 " + p.scrapSlot + "，不再可发。");
  say("ok", "退款不在仓库完成。仓库确认 " + p.id + " 在 " + p.scrapSlot + "，不能发给买家。");
  render();
}

function shelfBin(code) {
  if (!need("putaway")) return;
  const bin = binById(code);
  if (!bin || (bin.status !== "装货中" && bin.status !== "上架中")) {
    say("bad", "这只盆不是待上架的合格品盆。");
    return render();
  }
  const mo = motherById(bin.motherId);
  const loc = mo && locById(mo.locationId);
  bin.status = "上架中";
  S.shelf = { bin: bin.id, motherId: bin.motherId, step: "loc", placed: [], wait: "库位 " + (loc ? loc.id : "") };
  say("ok", "扫到上架盆 " + bin.id + "。PDA 提示库位 " + (loc ? loc.id + "（" + loc.type + "）" : "没有") + "。下一步扫库位，先不要把货记成已上架。");
  render();
}
function shelfLoc(code) {
  if (!need("putaway") || !S.shelf) return;
  const mo = motherById(S.shelf.motherId);
  if (code !== mo.locationId) {
    say("bad", "库位扫错。占用不发生，已匹配的库位也不释放。");
    beep(2);
    return render();
  }
  S.shelf.step = "item";
  S.shelf.wait = "盆里的定制品 ID";
  say("ok", "库位 " + code + " 扫对了。按顺序扫盆里每一个定制品 ID。");
  render();
}
function shelfItem(code) {
  if (!need("putaway") || !S.shelf || S.shelf.step !== "item") {
    say("bad", "还没到扫定制品 ID 这一步。");
    return render();
  }
  const bin = binById(S.shelf.bin);
  const p = pieceById(code);
  if (!p || !bin.pieceIds.includes(code)) {
    if (p && failed(p)) say("bad", "质检不通过的货不能放进订单仓。请去废品库位。");
    else { anomaly(code, "不属于这只上架盆"); say("bad", "这个码不在这只盆的应上架清单里。"); }
    beep(2);
    return render();
  }
  if (S.shelf.placed.includes(code)) { say("ok", "这一件刚刚扫过，不记成两件。"); return render(); }
  S.shelf.placed.push(code);
  if (S.shelf.placed.length === bin.pieceIds.length) {
    S.shelf.step = "empty";
    S.shelf.wait = "回扫空盆 " + bin.id;
    say("ok", "盆里应上的码都扫过了。再回扫空盆，才算上架成功。");
  } else say("ok", code + " 已放入。还没回扫空盆，这些件都还不是已上架。");
  render();
}
function shelfEmpty(code) {
  if (!need("putaway") || !S.shelf) return;
  if (S.shelf.step !== "empty" || code !== S.shelf.bin) {
    say("bad", "应上的定制品 ID 还没扫完，或回扫的不是这只空盆。整次不算上架成功，也不视为在库。");
    beep(2);
    return render();
  }
  const bin = binById(S.shelf.bin);
  const mo = motherById(S.shelf.motherId);
  const first = !mo.clockStart;
  const at = Date.now();
  bin.pieceIds.forEach(id => {
    const p = pieceById(id);
    p.stage = "已上架";
    p.slot = mo.locationId;
    p.putawayAt = at;
    p.bin = "";
    addEvent(p, "上架员", "上架", "四步扫完，上架成功，占用 " + mo.locationId + "。这才算在库。");
  });
  bin.pieceIds = [];
  bin.status = "已回空";
  bin.motherId = "";
  const loc = locById(mo.locationId);
  loc.status = "占用中";
  if (first) mo.clockStart = at;
  afterPutaway(mo);
  const kitted = allGoodShelved(mo) && piecesOf(mo.id).every(p => p.waveId || failed(p));
  let text = "已放入 " + loc.id + "，上架成功。请把空盆带回上架车。";
  if (first) text += " 72 小时从现在开始，含夜间和周末，法定节假日暂停。";
  else text += " 起算时间不重新计算。";
  if (kitted) text += " 母订单已凑齐，系统将自动跑" + (piecesOf(mo.id).length >= 2 ? "多件" : "单件") + "波次。";
  say("ok", text);
  S.shelf = null;
  if (kitted) goNext("wave", "去波次（下一屏：拣货员打面单）");
  else S.next = null;
  beep(1);
  render();
}

function printWave(id) {
  if (!need("waveRun")) return;
  const channel = (document.getElementById("channel") || {}).value || S.channel;
  S.channel = channel || "";
  if (!channel) { say("bad", "不选物流渠道，不能打印。工单仍待打。"); return render(); }
  const w = waveById(id);
  if (!w || w.status !== "待打单" || w.stopped) { say("bad", "这张工单不在待打单里。"); return render(); }
  w.channel = channel;
  w.waybill = "WB" + w.motherId.replace("MO-", "") + w.id.slice(-3);
  w.printed = true;
  w.oms = "";
  w.status = "待拣货";
  w.pieceIds.forEach(pid => {
    const p = pieceById(pid);
    if (p.stage === "已上架") {
      p.stage = "已入波次";
      addEvent(p, "拣货员", "波次", "跑打波次并打印面单 " + w.waybill + "。渠道 " + channel + "。状态变成已入波次。");
    }
  });
  say("ok", "面单 " + w.waybill + " 已打印。这一下没有写成已向客户发货。这是" + w.kind + "，没有和另一类并成一个包裹。件的状态变成已入波次。");
  goNext("pick", "去拣货（下一屏：拣货员按面单拣）");
  beep(1);
  render();
}
function doSplit(ids) {
  if (S.role === "拣货员") {
    say("bad", "拆单只有异常订单处理专员可以做。");
    return render();
  }
  if (!need("split")) return;
  const pcs = ids.map(pieceById).filter(p => p && p.stage === "已上架" && !p.waveId);
  if (!pcs.length) { say("bad", "没有可拆的在库货。废品、已入波次、只在盆里的都不能拆。"); return render(); }
  const groups = {};
  pcs.forEach(p => { (groups[p.motherId] = groups[p.motherId] || []).push(p); });
  Object.keys(groups).forEach(mid => createWave(motherById(mid), groups[mid], "拆单", "专员拆单"));
  say("ok", "已把勾选的在库件拆成波次，来源是专员拆单。没勾的仍留在库。请拣货员再去打面单。");
  render();
}
function oldWaybill(code) {
  return S.waves.find(w => (w.prev || []).includes(code));
}
function pickBill(code) {
  if (!need("pick")) return;
  if (oldWaybill(code)) { say("bad", "这是已经换掉的旧面单。请扫新号。这一步还不是已向客户发货。"); beep(2); return render(); }
  const w = S.waves.find(x => x.waybill === code);
  if (!w || w.stopped || w.status === "待打单" || !w.printed) {
    say("bad", w && w.stopped ? "这张面单已停止，请走新的波次。" : "没有这张待拣面单。");
    beep(2);
    return render();
  }
  if (!["待拣货", "拣货中"].includes(w.status)) { say("bad", "这张面单当前是「" + w.status + "」，不用再拣。"); return render(); }
  w.status = "拣货中";
  S.pick = { waveId: w.id };
  say("ok", "面单对上了母订单 " + w.motherId + "。请到库位逐件扫定制品 ID。");
  render();
}
function pickItem(code) {
  if (!need("pick")) return;
  if (!S.pick) { say("bad", "请先扫面单。"); beep(2); return render(); }
  const w = waveById(S.pick.waveId);
  const p = pieceById(code);
  if (!p) { anomaly(code, "码不存在"); say("bad", "没有这个码。清单不打勾。"); beep(2); return render(); }
  if (!w.pieceIds.includes(p.id)) { anomaly(code, "不在这张面单上"); say("bad", "这件属于 " + p.motherId + "，不在面单 " + w.waybill + " 上。不把货标成已拣。"); beep(2); return render(); }
  if (p.stage !== "已入波次") { say("ok", "已拣过。不记两件，也不提前释放库位。"); return render(); }
  p.stage = "已拣货";
  addEvent(p, "拣货员", "拣货", "按面单 " + w.waybill + " 拣出。");
  const left = w.pieceIds.map(pieceById).filter(x => x.stage === "已入波次");
  if (left.length) {
    say("ok", p.id + " 已拣货。还差 " + left.map(x => x.id).join("、") + "。库位仍占用。");
  } else {
    const mo = motherById(w.motherId);
    const slotName = mo.locationId || "库位";
    releaseSlot(mo);
    w.pieceIds.forEach(id => addEvent(pieceById(id), "系统", "库位", slotName + " 上这一波要拣的货都扫完了，库位已释放。"));
    if (w.pieceIds.length >= 2) {
      w.status = "待打包";
      w.sorted = w.sorted || [];
      say("ok", "库位 " + slotName + " 已释放。这一张面单有多件，请去多件复核。需要把这些件再归到这一张面单上时，可以另外打开二次分拣。");
      goNext("many", "去多件复核（下一屏：打包员）");
    } else {
      w.status = "待打包";
      say("ok", "库位 " + slotName + " 已释放。这一张面单只有一件，请去单件复核。");
      goNext("one", "去单件复核（下一屏：打包员）");
    }
  }
  beep(1);
  render();
}
function packOpen(code) {
  if (!need("pack")) return;
  if (oldWaybill(code)) { say("bad", "这是已经换掉的旧面单，不能打包。请扫新号。"); beep(2); return render(); }
  const w = S.waves.find(x => x.waybill === code);
  if (w && w.status === "待二次分拣") w.status = "待打包";
  if (!w || w.stopped || w.status !== "待打包") {
    say("bad", w && w.stopped ? "这张面单已停止，不能打包、不能称重。" : "运单号对不上待打包的母订单。");
    beep(2);
    return render();
  }
  const multi = w.pieceIds.length >= 2;
  if (S.page === "pack") S.reviewWhich = multi ? "多件" : "单件";
  if (S.reviewWhich === "单件" && multi) {
    say("bad", "这一单有 " + w.pieceIds.length + " 件，请打开多件复核。同款多件和多款多件都在那边。");
    return render();
  }
  if (S.reviewWhich === "多件" && !multi) {
    say("bad", "这一单只有 1 件，请打开单件复核。");
    return render();
  }
  if (!w.reviewAt) w.reviewAt = Date.now();
  S.pack = { waveId: w.id, camera: false, scanned: [], extras: [], sealed: false, early: false, alarm: false };
  say("ok", "打开母订单 " + w.motherId + "。请开启打包台相机。这一下只是找到主单，还不是在复核商品。");
  render();
}
function packItem(code) {
  if (!need("pack") || !S.pack) { say("bad", "请先扫运单号。"); return render(); }
  if (S.pack.early) { say("bad", "这个包裹已经要停。请把货交给异常订单处理专员。"); return render(); }
  const w = waveById(S.pack.waveId);
  if (!S.pack.camera) { say("bad", "先开启打包台相机，再扫定制品 ID。"); return render(); }
  const p = pieceById(code);
  if (!p || !w.pieceIds.includes(code)) {
    const why = p ? "属于 " + p.motherId : "系统没有这个码";
    S.pack.extras.push({ code, why });
    anomaly(code, "多件");
    say("bad", "多件。" + why + "。请反馈现场异常订单处理专员。");
    beep(2);
    return render();
  }
  if (S.pack.scanned.includes(code)) { say("ok", "这件已复核。刚刚重复扫过，不是多件。"); return render(); }
  S.pack.scanned.push(code);
  p.reviewed = true;
  addEvent(p, "打包员", "复核", "复核扫到这个定制品 ID。");
  if (S.pack.scanned.length === w.pieceIds.length && !S.pack.extras.length) {
    S.pack.alarm = false;
    say("ok", "应扫的定制品 ID 都对上了。请先封箱，封完再扫面单。");
  } else say("ok", code + " 已复核。还没齐，不能扫面单。");
  beep(1);
  render();
}
function packCheck() {
  if (!S.pack) return;
  const w = waveById(S.pack.waveId);
  const miss = w.pieceIds.filter(id => !S.pack.scanned.includes(id));
  if (miss.length || S.pack.extras.length) {
    S.pack.alarm = true;
    say("bad", "请反馈现场异常订单处理专员。" + (miss.length ? " 少件还没扫：" + miss.join("、") + "。" : "") + "不能变成待称重。");
    beep(2);
  } else say("ok", "没有少件，也没有多件。请先封箱。");
  render();
}
function packFinishScan(code) {
  if (!need("pack") || !S.pack) return;
  const w = waveById(S.pack.waveId);
  if (S.pack.early || S.pack.alarm || S.pack.extras.length || S.pack.scanned.length !== w.pieceIds.length) {
    say("bad", "少件、多件或已拦截时，不能二次扫面单。");
    beep(2);
    return render();
  }
  if (!S.pack.camera) { say("bad", "还没有打包录像，不能扫面单。"); return render(); }
  if (!S.pack.sealed) { say("bad", "请先封箱，封完再扫面单。"); return render(); }
  if (code !== w.waybill) { say("bad", "面单与当前母订单不一致。不记录待称重。"); beep(2); return render(); }
  w.status = "待出库称重";
  w.packed = true;
  w.packVideo = { name: w.motherId + "-打包视频", kind: "打包视频", status: "在系统服务器" };
  w.pieceIds.forEach(id => {
    const p = pieceById(id);
    p.stage = "已打包";
    addEvent(p, "打包员", "复核", "二次扫面单成功。已打包、待称重。还不是已向客户发货。");
  });
  say("ok", "已打包，待称重。不是已向客户发货。打包视频和质检视频分开留着。");
  goNext("weigh", "去称重出库（下一屏：发货员）");
  S.pack.alarm = false;
  beep(1);
  render();
}
function packStop() {
  if (!need("pack") || !S.pack) return;
  const w = waveById(S.pack.waveId);
  w.stopped = true;
  w.status = "已停止";
  w.voidReason = "复核前拦截";
  w.pieceIds.forEach(id => {
    const p = pieceById(id);
    p.stage = "已收货待质检";
    p.waveId = "";
    p.reviewed = false;
    p.slot = "";
    p.qc = null;
    addEvent(p, "打包员", "复核", "停止包裹打包复核。旧面单 " + w.waybill + " 作废。货交给专员，先重新质检。");
  });
  S.pack.alarm = false;
  S.pack.early = false;
  say("bad", "旧面单已停止，不能称重，也不能发。交回来的货回到已收货待质检，专员用质检屏和上架屏重走。没全部上架成功，不开新波次。");
  S.pack = null;
  render();
}
function packReshelf() {
  if (S.role === "拣货员") { say("bad", "少件多件由异常订单处理专员处理。"); return render(); }
  if (!need("shortFix")) return;
  if (!S.pack) return;
  const w = waveById(S.pack.waveId);
  w.stopped = true;
  w.status = "已停止";
  w.voidReason = "少件或多件";
  const mo = motherById(w.motherId);
  w.pieceIds.forEach(id => {
    const p = pieceById(id);
    if (p.qc && p.qc.result === "通过") {
      p.stage = "质检通过待上架";
      p.waveId = "";
      p.reviewed = false;
      p.slot = "";
      const bin = assignBin(mo);
      if (!bin.pieceIds.includes(p.id)) bin.pieceIds.push(p.id);
      p.bin = bin.id;
      if (!mo.locationId) matchLocation(mo);
      addEvent(p, "异常订单处理专员", "复核", "少件或多件。这件质检已通过，回到待上架，要重新上架后再跑波次。不用再质检一遍。旧面单作废。");
    }
  });
  S.pack.alarm = false;
  say("ok", "旧面单作废。质检已通过的件回到上架盆，状态是质检通过待上架。这不是「停止包裹打包复核」。");
  S.pack = null;
  goNext("putaway", "去上架（重新上到这张母订单的库位）");
  render();
}
function weighOpen(code) {
  if (!need("weigh")) return;
  if (oldWaybill(code)) { say("bad", "这是已经换掉的旧面单，不能称重。请扫新号。"); return render(); }
  const w = S.waves.find(x => x.waybill === code);
  if (!w || w.stopped || w.status !== "待出库称重") {
    say("bad", !w ? "没有这张待称重的面单。" : w.stopped ? "这张面单已停止，不能称重。" : "包裹还没到待称重。请回打包台。");
    return render();
  }
  S.weigh = w.id;
  S.weighState = "未读取";
  say("ok", "扫到面单。母订单 " + w.motherId + "。请把包裹放上出库秤，再点读取重量。只扫码、不称重，状态不变。");
  render();
}
function weighRead(ok) {
  if (!need("weigh") || !S.weigh) return;
  const w = waveById(S.weigh);
  if (!ok) {
    S.weighState = "没有稳定读数";
    w.pieceIds.forEach(id => addEvent(pieceById(id), "发货员", "称重", "秤没有稳定读数。状态仍是已打包、待称重。"));
    say("bad", "没有稳定重量，状态不变。可以再读一次。");
    return render();
  }
  const grams = S.weighDiff ? 910 : 380 + w.pieceIds.length * 40;
  S.weighDiff = false;
  w.weight = grams;
  w.weightOk = true;
  w.status = "已出库称重";
  w.oms = "已向客户发货";
  w.handover = false;
  S.weighState = "已稳定 " + grams + " 克";
  const diff = grams > 700;
  w.pieceIds.forEach(id => {
    const p = pieceById(id);
    p.stage = "已出库称重";
    addEvent(p, "发货员", "称重", "称重成功 " + grams + " 克。" + (diff ? "重量和预估不一样，不拦截。" : "") + "状态变成已出库称重。回写订单中台：已向客户发货。还没有装载交接。");
  });
  const mo = motherById(w.motherId);
  const partial = motherStatus(mo) === "部分出库";
  say("ok", "已出库称重，" + grams + " 克。" + (diff ? "重量和预估不一样，这次回写不拦截。" : "") + "已回写订单中台：已向客户发货。" + (partial ? " 母订单是部分出库。" : " 母订单是已出库称重。") + " 下一步装载交接，不移入笼车。");
  goNext("load", "去装载交接（下一屏：发货员）");
  S.query = w.motherId;
  beep(1);
  render();
}

function transferDoc(code) {
  return (S.transfers || []).find(t => t.pieceIds.includes(code) && t.status !== "调入完成")
    || (S.transfers || []).find(t => t.pieceIds.includes(code));
}
function transferConfirm(id) {
  if (!need("transferOk")) return;
  const t = (S.transfers || []).find(x => x.id === id);
  if (!t) return say("bad", "没有这张调拨单。");
  if (t.status !== "待主管确认") { say("ok", "这张调拨单已经确认过，现在是" + t.status + "。"); return render(); }
  const pcs = t.pieceIds.map(pieceById).filter(Boolean);
  const mo = pcs[0] ? motherById(pcs[0].motherId) : null;
  if (!mo || t.to !== mo.hub) { say("bad", "调入仓不是这张母订单的集货仓，不能确认。"); return render(); }
  if (pcs.some(p => p.waveId)) { say("bad", "已经在未完成的顾客波次里，不能再调拨。"); return render(); }
  t.status = "待调出";
  pcs.forEach(p => addEvent(p, "仓库主管", "调拨", "主管确认调拨单 " + t.id + "。从" + t.from + "调到集货仓" + t.to + "。还没扫出，不能质检，也不能打顾客面单。"));
  say("ok", "调拨单 " + t.id + " 已确认。请调拨员到" + t.from + "扫出。这一张不是顾客面单。");
  goNext("transfer", "换调拨员，扫出这一件");
  render();
}
function transferOut(code) {
  if (!need("transfer")) return;
  const p = pieceById(code);
  const t = transferDoc(code);
  if (!p || !t) { anomaly(code || "空码", "没有调拨单"); say("bad", "没有这件货的调拨单。不能凭空扫出。"); return render(); }
  if (t.status === "待主管确认") { say("bad", "主管还没确认 " + t.id + "。调拨员先不要扫。"); return render(); }
  if (p.waveId) { say("bad", "这件已经在顾客波次里，不能调出。"); return render(); }
  if (p.stage !== "待调出") { say("bad", "这件当前是「" + p.stage + "」，不用再扫出。"); return render(); }
  p.stage = "调拨在途";
  p.warehouse = "在途";
  const still = t.pieceIds.map(pieceById).some(x => x && x.stage === "待调出");
  t.status = still ? "待调出" : "调拨在途";
  addEvent(p, "调拨员", "调拨", "在" + t.from + "扫出。调拨单 " + t.id + " 变为调拨在途。杭州仓和淮安仓都不算在库，不能进波次，72 小时不开始。");
  say("ok", p.id + " 已从" + t.from + "交出，现在是调拨在途。两个仓的在库件数都不加它。请到" + t.to + "再扫一次。");
  goNext("transfer", "到集货仓再扫入");
  beep(1);
  render();
}
function transferIn(code) {
  if (!need("transfer")) return;
  const p = pieceById(code);
  const t = transferDoc(code);
  if (!p || !t) { say("bad", "没有这件货的调拨单。"); return render(); }
  if (p.stage !== "调拨在途") {
    say("bad", p.stage === "待调出" ? "还在调出仓，请先扫出。" : "这件当前是「" + p.stage + "」，不用再扫入。");
    return render();
  }
  const mo = motherById(p.motherId);
  if (t.to !== mo.hub) { say("bad", "调入仓不是集货仓 " + mo.hub + "，不能收成已收货。"); return render(); }
  const before = piecesOf(mo.id).length;
  p.stage = "已收货待质检";
  p.warehouse = mo.hub;
  p.via = "调拨调入 " + t.id;
  const still = t.pieceIds.map(pieceById).some(x => x && x.stage === "调拨在途");
  t.status = still ? "调拨在途" : "调入完成";
  addEvent(p, "调拨员", "调拨", "在集货仓 " + mo.hub + " 扫入。状态变成已收货待质检。应收仍是 " + before + " 件，没有因为调拨加一件。同一张母订单的清单自动合上。72 小时还不开始。");
  say("ok", p.id + " 已进入" + mo.hub + "，状态是已收货待质检。母订单 " + mo.id + " 应收还是 " + before + " 件。请去质检，不要再收一次货。");
  goNext("qc", "去质检（下一屏：质检员）");
  beep(1);
  render();
}
function transferByCode(code) {
  const p = pieceById(code);
  if (!p) { say("bad", "没有这个定制品 ID。"); return render(); }
  if (p.stage === "待调出") return transferOut(code);
  if (p.stage === "调拨在途") return transferIn(code);
  say("bad", "这件当前是「" + p.stage + "」，不在调拨扫码这一步。");
  render();
}
function asmScan(code) {
  if (!need("assemble")) return;
  const p = pieceById(code);
  if (!p) { say("bad", "没有这个定制品 ID。"); return render(); }
  const mo = motherById(p.motherId);
  if (!mo || !mo.vas) { say("bad", "这张单没有增值服务。同款多件默认不组装，不会出现在这一岗。"); return render(); }
  if (p.stage !== "待组装") { say("bad", "这件当前是「" + p.stage + "」。只有质检已通过、还没进上架盆的件才能组装。"); return render(); }
  if (p.warehouse !== mo.hub) { say("bad", "组装只在集货仓做。这件现在在" + p.warehouse + "。"); return render(); }
  if (!S.asm || S.asm.motherId !== mo.id) S.asm = { motherId: mo.id, scanned: [] };
  if (!S.asm.scanned.includes(p.id)) S.asm.scanned.push(p.id);
  addEvent(p, "组装员", "组装", "扫到 " + p.id + "。增值服务「" + mo.vas + "」还没点完成，所以还不能进上架盆。");
  say("ok", "已扫 " + p.id + "。清单扫齐后再点组装完成。");
  render();
}
function asmDone(id) {
  if (!need("assemble")) return;
  const mo = motherById(id);
  if (!mo || !mo.vas) { say("bad", "这张单没有增值服务。"); return render(); }
  const waiting = piecesOf(mo.id).filter(p => p.stage === "待组装");
  if (!waiting.length) { say("bad", "没有待组装的件。"); return render(); }
  const scanned = S.asm && S.asm.motherId === mo.id ? S.asm.scanned : [];
  const lack = waiting.filter(p => !scanned.includes(p.id)).map(p => p.id);
  if (lack.length) { say("bad", "少扫就不能完成。还没扫：" + lack.join("、") + "。"); return render(); }
  const loc = matchLocation(mo);
  if (!loc) { say("bad", "没有装得下的空库位。组装先不要记成可以上架。"); return render(); }
  const bin = assignBin(mo);
  waiting.forEach(p => {
    p.stage = "质检通过待上架";
    p.bin = bin.id;
    if (!bin.pieceIds.includes(p.id)) bin.pieceIds.push(p.id);
    addEvent(p, "组装员", "组装", "增值服务「" + mo.vas + "」做完。放入上架盆 " + bin.id + "。库位 " + loc.id + " 只是提前匹配。还不算在库，72 小时不从这一下起算。");
  });
  S.asm = null;
  say("ok", "组装完成。放入上架盆 " + bin.id + "。状态变成质检通过待上架。请上架员走原来的四步。72 小时还没开始。");
  goNext("putaway", "去上架（下一屏：上架员）");
  beep(1);
  render();
}

function doCheck(slot, seen) {
  if (!need("check")) return;
  const loc = locById(slot);
  if (!loc || loc.kind !== "order") { say("bad", "请先选一个订单库位。"); return render(); }
  const book = S.pieces.filter(p => p.slot === loc.id).map(p => p.id);
  const match = book.includes(seen);
  const result = match ? "对得上" : "对不上，只记下";
  S.checks.unshift({ t: now(), slot: loc.id, book: book.join("、") || "空", seen, result, who: S.role });
  S.logs.unshift({ t: now(), who: S.role, step: "核对", text: loc.id + " 账面 " + (book.join("、") || "空") + "，看到 " + seen + "。" + result + "。货的状态没有改。", id: seen, motherId: loc.motherId || "" });
  say(match ? "ok" : "bad", loc.id + " " + result + "。没有改这件货的状态，也没有可卖数量。");
  render();
}
function reprintBill(id) {
  if (!need("waybill")) return;
  const w = waveById(id);
  if (!w || !w.printed) { say("bad", "还没有面单，请先去波次屏打单。"); return render(); }
  if (w.stopped) { say("bad", "这张波次已经停止。请走异常订单处理专员的新波次，不要在这里复活旧号。"); return render(); }
  if (w.weightOk) { say("bad", "已经称重，订单中台是已向客户发货。不能在仓库再换号或补打。"); return render(); }
  w.pieceIds.forEach(pid => addEvent(pieceById(pid), "拣货员", "面单", "按原号再打一张 " + w.waybill + "。号码不变。还不是已向客户发货。"));
  say("ok", "已按原号再打 " + w.waybill + "。母订单仍是 " + w.motherId + "。没有写成已向客户发货。");
  render();
}
function replaceBill(id) {
  if (!need("waybill")) return;
  const w = waveById(id);
  if (!w || !w.printed) { say("bad", "还没有面单，不能请中台重取。"); return render(); }
  if (w.stopped) { say("bad", "这张波次已经停止。新面单要由专员重跑波次，不在这里换号。"); return render(); }
  if (w.weightOk) { say("bad", "已经称重并回写已向客户发货。仓库不能再换面单号。"); return render(); }
  const old = w.waybill;
  w.prev = w.prev || [];
  w.prev.push(old);
  w.waybill = "WB" + w.motherId.replace("MO-", "") + "N" + w.prev.length;
  w.pieceIds.forEach(pid => addEvent(pieceById(pid), "拣货员", "面单", "旧面单 " + old + " 停止。订单中台重取新号 " + w.waybill + "。收件地址不在仓库改。还不是已向客户发货。"));
  say("ok", "旧号 " + old + " 已停止。新号 " + w.waybill + " 仍只属于母订单 " + w.motherId + "。拣货、复核、称重改扫新号。");
  render();
}
function printLabel(code) {
  if (!need("waybill")) return;
  const p = pieceById(code);
  if (!p) { say("bad", "没有这个定制品 ID。仓库不另编一个新码。"); return render(); }
  S.label = p.id;
  say("ok", "标签只印 " + p.id + "。这是工厂原来的定制品 ID，仓库没有新编。");
  render();
}

function refreshBox(b) {
  const matched = b.lines.every(l => l.actual === l.expect);
  const any = b.lines.some(l => l.actual != null);
  b.ok = matched;
  b.diff = any && !matched ? "件数对不上" : "";
}
function postOpen(code) {
  if (!need("post")) return;
  const b = boxOpen(code);
  if (!b) { say("bad", "没有这张集货快递单号。请扫供应商发给仓库的单号，例如 SF86001。"); return render(); }
  S.postBox = b.express;
  say("ok", "集货快递 " + b.express + " 对上到货单 " + b.id + "，供应商 " + b.supplier + "，母订单 " + b.motherId + "。请按每个定制品 ID 清点件数。");
  render();
}
function postLine(express, id, qty) {
  if (!need("post")) return;
  const b = boxOpen(express);
  const line = b && b.lines.find(l => l.id === id);
  if (!line) { say("bad", "这箱里没有这个定制品 ID。"); return render(); }
  line.actual = Number(qty);
  refreshBox(b);
  if (b.ok) say("ok", b.express + " 每个定制品 ID 的件数都对上了。可以去收货。扫一次只收一件，还没写成已收货。");
  else say("bad", id + " 清点 " + line.actual + " 件，供应商清单是 " + line.expect + " 件。对不上，不能收成已收货。");
  render();
}
function postMatch(express) {
  if (!need("post")) return;
  const b = boxOpen(express);
  if (!b) return;
  b.lines.forEach(l => { l.actual = l.expect; });
  refreshBox(b);
  say("ok", b.express + " 已按供应商清单点齐。请去收货，扫定制品 ID。");
  goNext("receive", "去收货（下一屏：收货员）");
  render();
}
function postShort(express) {
  if (!need("post")) return;
  const b = boxOpen(express);
  if (!b) return;
  const line = b.lines[0];
  line.actual = Math.max(0, line.expect - 1);
  refreshBox(b);
  say("bad", line.id + " 只点到 " + line.actual + " 件，清单是 " + line.expect + " 件。这一箱不能收成已收货。");
  render();
}
function saveCutoff(code) {
  if (!need("cutoff")) return;
  if (!/^\d{1,2}:\d{2}$/.test(code)) { say("bad", "请写成钟点，例如 16:00。这个时间由仓库主管改，不是系统写死的下班时间。"); return render(); }
  S.cutoff = code;
  say("ok", "收货截单时间改成 " + code + "。截单前到的集货快递箱，当天要把箱里每个定制品 ID 收完。");
  render();
}
function rebinBill(code) {
  if (!need("rebin")) return;
  const w = S.waves.find(x => x.waybill === code || x.id === code);
  if (!rebinEligible(w)) { say("bad", "这一屏只归拢已经拣完、还没称重的一单多件。单件不在这里。没拣完的先去拣货。"); return render(); }
  S.rebin = w.id;
  w.sorted = w.sorted || [];
  say("ok", "面单 " + w.waybill + " 只汇母订单 " + w.motherId + " 的货。请逐件扫这张单上的定制品 ID。");
  render();
}
function rebinItem(code) {
  if (!need("rebin")) return;
  const w = waveById(S.rebin);
  if (!w) { say("bad", "请先扫这一张面单。"); return render(); }
  const p = pieceById(code);
  if (!p) { say("bad", "没有这个定制品 ID。"); return render(); }
  if (p.motherId !== w.motherId || !w.pieceIds.includes(p.id)) {
    say("bad", p.id + " 属于母订单 " + p.motherId + "。不能放进母订单 " + w.motherId + " 的面单 " + w.waybill + "。一张母订单仍是自己的包裹。");
    return render();
  }
  w.sorted = w.sorted || [];
  if (!w.sorted.includes(p.id)) w.sorted.push(p.id);
  addEvent(p, "拣货员", "二次分拣", "汇到面单 " + w.waybill + "。只属于母订单 " + w.motherId + "。");
  if (w.pieceIds.every(id => w.sorted.includes(id))) {
    if (w.status === "待二次分拣") w.status = "待打包";
    say("ok", "这一张面单上的件都归拢了。多件复核不靠这一步才能打开。没有和另一张母订单并成一个包裹。");
    goNext("many", "可以去多件复核（下一屏：打包员）");
  } else {
    say("ok", p.id + " 已汇上。还差 " + w.pieceIds.filter(id => !w.sorted.includes(id)).join("、") + "。");
  }
  render();
}
function doHandover(id) {
  if (!need("handover")) return;
  const w = waveById(id);
  if (!w || !w.weightOk) { say("bad", "没称重成功的运单不能交接，也不会出现在当日交接清单。"); return render(); }
  w.handover = true;
  w.handoverAt = now();
  w.pieceIds.forEach(pid => {
    const p = pieceById(pid);
    if (p) addEvent(p, "发货员", "装载交接", "运单 " + w.waybill + " 已交接。没有移入笼车。");
  });
  say("ok", "运单 " + w.waybill + " 已装载交接。可以打出当日交接清单。");
  render();
}
function factoryScan(code) {
  if (!need("factory")) return;
  const p = pieceById(code);
  if (!p || p.stage !== "待工厂复核") { say("bad", "这件不在淮安待复核。"); return render(); }
  if (!S.factoryScan || S.factoryScan.motherId !== p.motherId) S.factoryScan = { motherId: p.motherId, ids: [] };
  if (!S.factoryScan.ids.includes(p.id)) S.factoryScan.ids.push(p.id);
  addEvent(p, "打包员", "淮安复核", "在淮安扫过 " + p.id + "。还没打顾客面单，也还不是已向客户发货。");
  say("ok", p.id + " 已复核。一件和多件都可以在淮安直发。只有超尺寸、物流到不了、地址或国家有问题才转杭州。");
  render();
}
function factoryShip(id) {
  if (!need("factory")) return;
  const mo = motherById(id);
  const ps = piecesOf(id).filter(p => p.stage === "待工厂复核");
  if (!mo || !ps.length) { say("bad", "没有待复核的件。"); return render(); }
  if (ps.some(p => p.exception)) { say("bad", "这件是" + ps.find(p => p.exception).exception + "，淮安发不出去。请转到杭州，不要在这里直发。"); return render(); }
  const scanned = S.factoryScan && S.factoryScan.motherId === id ? S.factoryScan.ids : [];
  if (!ps.every(p => scanned.includes(p.id))) { say("bad", "请先把这一单的定制品 ID 逐件扫完。"); return render(); }
  const multi = ps.length >= 2;
  const w = {
    id: nextId("WV"), motherId: mo.id, kind: multi ? "多件波次" : "单件波次", mode: "淮安直发",
    source: multi ? "淮安工厂多件复核" : "淮安工厂单件复核",
    status: "待出库称重", pieceIds: ps.map(p => p.id),
    channel: "演示渠道", waybill: "WB" + mo.id.replace("MO-", ""), printed: true, stopped: false,
    packed: true, weight: null, weightOk: false, packVideo: null, oms: "", handover: false,
  };
  S.waves.push(w);
  ps.forEach(p => {
    p.waveId = w.id;
    p.stage = "已打包";
    p.reviewed = true;
    p.warehouse = "淮安仓";
    addEvent(p, "打包员", "淮安复核", (multi ? "淮安多件复核" : "淮安单件复核") + "通过，面单 " + w.waybill + " 已打出。不进杭州质检和上架。72 小时不从淮安起算。打面单还不是已向客户发货。");
  });
  mo.clockStart = null;
  mo.hub = "淮安仓";
  say("ok", (multi ? "淮安多件" : "淮安单件") + "复核通过。不进杭州质检和上架。72 小时不从淮安起算。面单已打出，还没有写成已向客户发货。请去称重。");
  goNext("weigh", "去称重出库（下一屏：发货员）");
  render();
}
function factoryHub(id) {
  if (!need("factory")) return;
  const mo = motherById(id);
  const ps = piecesOf(id).filter(p => p.stage === "待工厂复核" || p.stage === "待调出");
  if (!mo || !ps.length) { say("bad", "没有可以转杭州的件。"); return render(); }
  const reasons = ["超尺寸", "物流渠道到不了", "地址或国家有问题"];
  const reason = ps.map(p => p.exception).find(r => reasons.includes(r));
  if (!reason) {
    say("bad", "不因为是多件就改送到杭州质检、上架。一件和多件都可以在淮安复核后直发。只有超尺寸、物流渠道到不了、地址或国家有问题，才转到杭州。");
    return render();
  }
  const scanned = S.factoryScan && S.factoryScan.motherId === id ? S.factoryScan.ids : [];
  if (!ps.every(p => scanned.includes(p.id) || p.stage === "待调出")) { say("bad", "请先扫这一件，确认是" + reason + "。"); return render(); }
  if (S.transfers.some(t => t.pieceIds.includes(ps[0].id) && t.status !== "调入完成")) {
    say("ok", "这件已经有调拨单，没有打顾客面单。");
    return render();
  }
  ps.forEach(p => {
    p.stage = "待调出";
    p.warehouse = "淮安仓";
    p.waveId = "";
    addEvent(p, "打包员", "淮安复核", "淮安发不出去（" + reason + "）。转到杭州。到了杭州仍要质检、上架。不打顾客面单。72 小时不从淮安起算。");
  });
  mo.clockStart = null;
  mo.hub = "杭州仓";
  S.transfers.push({ id: "DB-" + mo.id.replace("MO-", ""), from: "淮安仓", to: "杭州仓", status: "待主管确认", pieceIds: ps.map(p => p.id) });
  say("ok", reason + "，已转到杭州。调拨单不是顾客面单。到了杭州仍要质检、上架。72 小时不从淮安起算。");
  goNext("transfer", "去调拨（下一屏：仓库主管确认）");
  render();
}
function returnScan(code) {
  if (!need("frame")) return;
  const p = pieceById(code);
  if (!p) { say("bad", "没有这个定制品 ID。退货页不另建可卖库存。"); return render(); }
  const result = failed(p) ? "废品只记一笔，不能改判合格" : "只记退货，货的状态不改";
  S.returns.unshift({ t: now(), id: p.id, result, who: S.role });
  say("ok", p.id + "：" + result + "。当前仍是「" + p.stage + "」。");
  render();
}

function onAct(el) {
  const act = el.dataset.act;
  if (act === "goto") {
    S.page = el.dataset.page || S.page;
    if (el.dataset.id) S.focus = el.dataset.id;
    S.last = null;
    S.next = null;
    return render();
  }
  if (act === "bucket") {
    S.bucket = el.dataset.name;
    S.page = "kanban";
    return render();
  }
  if (act === "do-receive") return doReceive(el.dataset.code);
  if (act === "transfer-ok") return transferConfirm(el.dataset.id);
  if (act === "transfer-out") return transferOut(el.dataset.code);
  if (act === "transfer-in") return transferIn(el.dataset.code);
  if (act === "transfer-print") { say("bad", "调拨单不能打印顾客面单，也不能拿去对顾客发货。顾客面单只在波次屏、按母订单打印。"); return render(); }
  if (act === "transfer-wrong") { say("bad", "调入仓必须是这张母订单的集货仓（杭州仓）。不能把货调进别的仓库再当已收货。"); return render(); }
  if (act === "gather-merge") { say("bad", "不能把两张母订单合成一个顾客包裹。合单只把同一张母订单分批到齐的定制品 ID 放进这一张清单。"); return render(); }
  if (act === "asm-scan") return asmScan(el.dataset.code);
  if (act === "asm-done") return asmDone(el.dataset.id);
  if (act === "stock-wh") { S.stockWh = el.dataset.name; S.page = "stock"; return render(); }
  if (act === "check-slot") { S.checkSlot = el.dataset.id; S.page = "check"; return render(); }
  if (act === "check-seen") return doCheck(el.dataset.slot, el.dataset.code);
  if (act === "bill-reprint") return reprintBill(el.dataset.id);
  if (act === "bill-replace") return replaceBill(el.dataset.id);
  if (act === "undo-receive") {
    const u = S.recvUndo;
    if (!u || Date.now() - u.at > 60000) { say("bad", "已经超过 60 秒，不能在收货屏撤销。"); return render(); }
    const p = pieceById(u.id);
    if (p && p.stage === "已收货待质检") {
      p.stage = "待收货";
      addEvent(p, "收货员", "收货", "撤销本次收货，回到待收货。同一子订单下其他件不动。");
      say("ok", p.id + " 回到待收货。");
    }
    S.recvUndo = null;
    return render();
  }
  if (act === "open-qc") return openQc(el.dataset.code);
  if (act === "qc-photo") {
    if (!S.qc) return;
    S.qc.photo = true;
    const p = pieceById(S.qc.id);
    if (p && p.expect && !S.qc.manual) {
      S.qc.size = p.expect.size; S.qc.color = p.expect.color; S.qc.material = p.expect.material;
    }
    say("ok", "照片已留在系统服务器。请核对尺寸、颜色、材质，再由人点通过或不通过。识别结果不会自己变成通过。");
    return render();
  }
  if (act === "qc-video") {
    if (!S.qc) return;
    S.qc.video = true;
    say("ok", "质检视频已保存。不是高价值的件不要求这一步。");
    return render();
  }
  if (act === "qc-weight") {
    if (!S.qc) return;
    S.qc.weight = "126 克";
    S.qc.weightNote = "质检秤读到 126 克。这个重量不挡住通过或不通过。";
    say("ok", S.qc.weightNote);
    return render();
  }
  if (act === "qc-manual") {
    if (!S.qc) return;
    S.qc.manual = true; S.qc.size = ""; S.qc.color = ""; S.qc.material = "";
    say("ok", "识别失败。请手填尺寸、颜色、材质。填完整后才可以由人点通过。");
    return render();
  }
  if (act === "qc-pass") return qcPass();
  if (act === "qc-fail") return qcFail();
  if (act === "scrap-id") return scrapId(el.dataset.code);
  if (act === "scrap-loc") return scrapLoc(el.dataset.code);
  if (act === "order-redo") return orderRedo(el.dataset.id);
  if (act === "order-cancel") return orderCancel(el.dataset.id);
  if (act === "shelf-bin") return shelfBin(el.dataset.code);
  if (act === "shelf-loc") return shelfLoc(el.dataset.code);
  if (act === "shelf-item") return shelfItem(el.dataset.code);
  if (act === "shelf-empty") return shelfEmpty(el.dataset.code);
  if (act === "print-wave") return printWave(el.dataset.id);
  if (act === "auto-split") {
    const mo = motherById(el.dataset.id);
    const w = autoSplit(mo);
    say(w ? "ok" : "bad", w ? "已只把在库的件拆进" + w.kind + "。来源是自动超时。废品和没上架的不在里面。" : "现在拆不出在库的件。");
    if (w) goNext("wave", "去给这张拆单打印面单");
    return render();
  }
  if (act === "fake-72") {
    const mo = motherById(el.dataset.id);
    if (!mo.clockStart) { say("bad", "这张单还没有上架占用，不能把 72 小时拨满。"); return render(); }
    mo.clockStart = Date.now() - H72 - 60000;
    say("ok", "仅演练：这张母订单按已满 72 小时计。收货和已上架的状态没有被改掉。可以让系统拆出已经在库的件。");
    return render();
  }
  if (act === "holiday") {
    const mo = motherById(el.dataset.id);
    if (!mo.clockStart) { say("bad", "还没起算，谈不上暂停。"); return render(); }
    mo.holidayPauseMs += 24 * 3600 * 1000;
    say("ok", "仅演练：这张单按法定节假日暂停了一天。已累计的时间不清零，截止顺延。周末本来就不暂停。");
    return render();
  }
  if (act === "do-split") {
    const ids = [...document.querySelectorAll("[data-split]:checked")].map(x => x.dataset.split);
    return doSplit(ids);
  }
  if (act === "pick-bill") return pickBill(el.dataset.code);
  if (act === "pick-item") return pickItem(el.dataset.code);
  if (act === "pack-open") return packOpen(el.dataset.code);
  if (act === "pack-camera") {
    if (!S.pack) return;
    S.pack.camera = true;
    const w = waveById(S.pack.waveId);
    say("ok", "打包台相机已开。请按母订单 " + w.motherId + " 下每一个定制品 ID 复核。");
    return render();
  }
  if (act === "pack-item") return packItem(el.dataset.code);
  if (act === "pack-check") return packCheck();
  if (act === "pack-sealed") {
    if (!S.pack) return;
    S.pack.sealed = true;
    say("ok", "已记下你封好了箱。请再扫一次当前这张面单。");
    return render();
  }
  if (act === "pack-seal-scan") return packFinishScan(el.dataset.code);
  if (act === "pack-early") {
    if (!S.pack) return;
    S.pack.early = true;
    say("bad", "目前在库还有该订单的子订单商品，请反馈现场异常订单处理专员。");
    return render();
  }
  if (act === "pack-stop") return packStop();
  if (act === "pack-reshelf") return packReshelf();
  if (act === "weigh-open") return weighOpen(el.dataset.code);
  if (act === "weigh-read") return weighRead(true);
  if (act === "weigh-diff") { S.weighDiff = true; return weighRead(true); }
  if (act === "weigh-fail") return weighRead(false);
  if (act === "post-open") return postOpen(el.dataset.code);
  if (act === "post-line") return postLine(el.dataset.express, el.dataset.id, el.dataset.qty);
  if (act === "post-match") return postMatch(el.dataset.express);
  if (act === "post-short") return postShort(el.dataset.express);
  if (act === "rebin-bill") return rebinBill(el.dataset.code);
  if (act === "rebin-item") return rebinItem(el.dataset.code);
  if (act === "rebin-merge") { say("bad", "不能按收件人把两张母订单合成一张面单。一张母订单仍是自己的包裹。调拨单也不是顾客面单。"); return render(); }
  if (act === "handover") return doHandover(el.dataset.id);
  if (act === "handover-list") { S.showList = true; say("ok", "当日交接清单只列已经称重并且已经交接的运单。没称重的不在里面。"); return render(); }
  if (act === "factory-scan") return factoryScan(el.dataset.code);
  if (act === "factory-ship") return factoryShip(el.dataset.id);
  if (act === "factory-hub") return factoryHub(el.dataset.id);
  if (act === "return-scan") return returnScan(el.dataset.code);
  if (act === "trace-go") { S.query = el.dataset.code; S.page = "trace"; return render(); }
  if (act === "night") {
    const files = [];
    S.pieces.forEach(p => {
      if (p.qc && p.qc.photos) p.qc.photos.forEach(f => { f.status = "已到本地服务器"; files.push(f); });
      if (p.qc && p.qc.video && p.qc.video.status) { p.qc.video.status = "已到本地服务器"; files.push(p.qc.video); }
    });
    S.waves.forEach(w => { if (w.packVideo) { w.packVideo.status = "已到本地服务器"; files.push(w.packVideo); } });
    say("ok", "仅演练：夜间窗口把 " + files.length + " 个影像文件标成已到本地服务器。出库状态没有改。这是留档，不是放行。");
    return render();
  }
  if (act === "reset") { S = seed(); toast("已回到初始演示数据。"); return render(); }
  if (act === "password" || act === "lang" || act === "logout") { toast("这是作业演示，不改密码、不切换语言、也不真正退出。"); return; }
  if (act === "notice") { S.notice = !S.notice; return render(); }
}

document.body.addEventListener("click", (e) => {
  const el = e.target.closest("[data-act]");
  if (!el) return;
  onAct(el);
});
document.body.addEventListener("submit", (e) => {
  const form = e.target.closest("form[data-form]");
  if (!form) return;
  e.preventDefault();
  const code = String(new FormData(form).get("code") || "").trim();
  const kind = form.dataset.form;
  if (kind === "receive") return doReceive(code);
  if (kind === "transfer") return transferByCode(code);
  if (kind === "assemble") return asmScan(code);
  if (kind === "qc") return openQc(code);
  if (kind === "pick") {
    if (S.pick && pieceById(code)) return pickItem(code);
    return pickBill(code);
  }
  if (kind === "pack") {
    if (S.pack && code !== (waveById(S.pack.waveId) || {}).waybill) return packItem(code);
    if (S.pack && S.pack.sealed) return packFinishScan(code);
    return packOpen(code);
  }
  if (kind === "weigh") return weighOpen(code);
  if (kind === "trace") { S.query = code; S.page = "trace"; return render(); }
  if (kind === "label") return printLabel(code);
  if (kind === "post") return postOpen(code);
  if (kind === "cutoff") return saveCutoff(code);
  if (kind === "rebin") {
    if (S.rebin && pieceById(code)) return rebinItem(code);
    return rebinBill(code);
  }
  if (kind === "move") {
    if (!need("frame")) return;
    const from = String(new FormData(form).get("from") || "").trim();
    const to = String(new FormData(form).get("to") || "").trim();
    if (!from || !to) { say("bad", "请写下从哪一格到哪一格。这一笔记下后，货的状态不变。"); return render(); }
    S.moves.unshift({ t: now(), from, to, who: S.role, text: "只记一笔，不改在库状态" });
    say("ok", "已记下从 " + from + " 到 " + to + "。货还在原来的状态，没有跳过收货、质检、上架。");
    return render();
  }
  if (kind === "special") {
    if (!need("frame")) return;
    if (!code) { say("bad", "请写原因。这一页不把货收成已收货。"); return render(); }
    S.specials.unshift({ t: now(), reason: code, qty: "1", who: S.role });
    say("ok", "已送审：" + code + "。还没入库，也不能变成可卖库存，更不能跳过质检。");
    return render();
  }
});
document.body.addEventListener("change", (e) => {
  if (e.target.id === "role") { S.role = e.target.value; render(); }
  if (e.target.id === "channel") S.channel = e.target.value;
  if (e.target.id === "qc-size" || e.target.id === "qc-color" || e.target.id === "qc-material") readQcFields();
});
window.addEventListener("error", (e) => {
  const box = document.getElementById("main");
  if (box) box.insertAdjacentHTML("afterbegin", `<div class="badnote">这一页没有画出来：${esc(e.message || "未知错误")}</div>`);
});
render();
