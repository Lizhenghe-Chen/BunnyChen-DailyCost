use chrono::Utc;
use rusqlite::{backup::Backup, params, Connection};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{Emitter, Manager};
use tauri::State;

// ── 数据结构 ──────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OrderItem {
    pub id: i64,
    pub order_id: String,
    pub parent_order_id: String,
    pub product_id: String,
    pub platform: String,
    pub store_name: String,
    pub product_name: String,
    pub model_style: String,
    pub quantity: i32,
    pub total_price: f64,
    pub order_time: String,
    pub daily_avg_cost: f64,
    pub emoji: String,
    pub import_batch: String,
    pub product_url: String,
    pub end_date: String,
    pub end_reason: String,
    pub sell_price: f64,
    pub archived: bool,
    /// 商品分类（自动匹配填充，可在编辑中修改）
    pub category: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ImportResult {
    pub success: bool,
    pub imported: usize,
    pub skipped: usize,
    pub message: String,
}

/// 微信收支总览（支出/回款/净支出）
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WechatOverview {
    pub expense_total: f64,
    pub income_total: f64,
    pub net_total: f64,
}

/// 微信收入按交易类型分组（退款/转账/红包/收款等）
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct IncomeByType {
    pub income_type: String,
    pub total: f64,
    pub count: i64,
}

/// 微信收入按交易对方分组（回款来源 Top）
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct IncomePeer {
    pub peer: String,
    pub total: f64,
    pub count: i64,
}

/// 微信月度收支（支出/回款/净支出）
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WechatMonthly {
    pub month: String,
    pub expense: f64,
    pub income: f64,
    pub net: f64,
}

/// 微信收支分析（供分析页「微信收支」区块一次拉取）
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WechatAnalytics {
    pub overview: WechatOverview,
    pub by_type: Vec<IncomeByType>,
    pub peers: Vec<IncomePeer>,
    pub monthly: Vec<WechatMonthly>,
}

// ── 数据库状态 ────────────────────────────────────────────

pub struct DbState {
    pub db: Mutex<Connection>,
    pub db_path: PathBuf,
}

/// 获取数据库路径
fn get_db_path(app_data_dir: PathBuf) -> PathBuf {
    app_data_dir.join("bookkeeping.db")
}

/// 初始化数据库和表结构
fn init_db(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS orders (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id        TEXT    NOT NULL,
            parent_order_id TEXT    DEFAULT '',
            product_id      TEXT    DEFAULT '',
            platform        TEXT    NOT NULL,
            store_name      TEXT    DEFAULT '',
            product_name    TEXT    NOT NULL,
            model_style     TEXT    DEFAULT '',
            quantity        INTEGER DEFAULT 1,
            total_price     REAL    NOT NULL DEFAULT 0,
            order_time      TEXT    DEFAULT '',
            import_batch    TEXT    DEFAULT '',
            created_at      TEXT    DEFAULT (datetime('now','localtime'))
        );

        CREATE TABLE IF NOT EXISTS income_records (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id     TEXT    NOT NULL,
            platform     TEXT    NOT NULL,
            peer         TEXT    DEFAULT '',
            income_type  TEXT    DEFAULT '',
            amount       REAL    NOT NULL DEFAULT 0,
            order_time   TEXT    DEFAULT '',
            status       TEXT    DEFAULT '',
            import_batch TEXT    DEFAULT '',
            created_at   TEXT    DEFAULT (datetime('now','localtime'))
        );

        CREATE TABLE IF NOT EXISTS settings (
            key   TEXT PRIMARY KEY,
            value TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_orders_parent ON orders(parent_order_id);
        CREATE INDEX IF NOT EXISTS idx_orders_platform ON orders(platform);
        ",
    )?;

    // 迁移：添加 product_url 列（兼容旧数据库）
    let _ = conn.execute("ALTER TABLE orders ADD COLUMN product_url TEXT DEFAULT ''", []);
    // 迁移：添加 product_id 列（商品编号）
    let _ = conn.execute("ALTER TABLE orders ADD COLUMN product_id TEXT DEFAULT ''", []);
    // 迁移：添加 emoji 列（用户可自定义）
    let _ = conn.execute("ALTER TABLE orders ADD COLUMN emoji TEXT DEFAULT ''", []);
    // 迁移：添加 end_date / end_reason / sell_price 列（物品使用截止）
    let _ = conn.execute("ALTER TABLE orders ADD COLUMN end_date TEXT DEFAULT ''", []);
    let _ = conn.execute("ALTER TABLE orders ADD COLUMN end_reason TEXT DEFAULT ''", []);
    let _ = conn.execute("ALTER TABLE orders ADD COLUMN sell_price REAL DEFAULT 0", []);
    // 迁移：添加 archived 列（归档标记，0=正常 1=已归档）
    let _ = conn.execute("ALTER TABLE orders ADD COLUMN archived INTEGER DEFAULT 0", []);
    // 迁移：添加 category 列（商品分类，预留字段暂不使用）
    let _ = conn.execute("ALTER TABLE orders ADD COLUMN category TEXT DEFAULT ''", []);
    // 迁移：修复双倍时间格式 "YYYY-MM-DD 00:00:00 00:00:00" → "YYYY-MM-DD"
    let _ = conn.execute(
        "UPDATE orders SET order_time = substr(order_time, 1, 10) WHERE order_time LIKE '%00:00:00 00:00:00'",
        [],
    );
    // 迁移：平台值归一化（旧版样例数据用中文 京东/淘宝/Steam，CSV 导入用缩写 jd/tb/steam，
    // 合并同一平台的不同写法，避免平台筛选下拉出现重复项与统计拆分）
    let _ = conn.execute("UPDATE orders SET platform='jd' WHERE platform='京东'", []);
    let _ = conn.execute("UPDATE orders SET platform='tb' WHERE platform='淘宝'", []);
    let _ = conn.execute("UPDATE orders SET platform='steam' WHERE platform='Steam'", []);

    // 索引：archived 列依赖上面的迁移（旧库经 ALTER 补齐），必须在迁移之后创建
    // 加速 archived 过滤 + order_time 排序的主查询
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_orders_archived_time ON orders(archived, order_time)",
        [],
    )?;

    // 索引：微信收入按时间排序查询
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_income_time ON income_records(order_time)",
        [],
    )?;

    Ok(())
}

// ── 智能匹配：分类 + Emoji（统一层级结构）────────────────

/// 分类定义：每个分类包含若干子项，每个子项有关键词 + emoji
/// 一次匹配同时返回 category_id 和 emoji，零冗余
struct CategoryDef {
    id: &'static str,       // 分类ID："digital", "clothing", ...
    items: &'static [(&'static [&'static str], &'static str)],  // (关键词, emoji)
}

/// 统一匹配：根据产品名+店铺+平台，一次返回 (category_id, emoji)
/// 未匹配到任何关键词时返回 ("other", "📦")
fn match_product_category(name: &str, store: &str, platform: &str) -> (&'static str, &'static str) {
    static CATEGORY_MAP: &[CategoryDef] = &[
        CategoryDef { id: "digital", items: &[
            (&["手机", "phone", "iphone", "小米", "华为", "oppo", "vivo", "三星", "galaxy", "oneplus", "一加"], "📱"),
            (&["电脑", "笔记本", "notebook", "laptop", "macbook", "thinkpad", "x1", "carbon", "游戏本", "台式机", "一体机", "desktop"], "💻"),
            (&["平板", "pad", "ipad", "tablet", "surface"], "📲"),
            (&["相机", "camera", "镜头", "osmo", "pocket", "大疆", "dji", "gopro", "单反", "微单", "胶片", "胶卷", "闪光灯", "三脚架", "滤镜", "uv镜", "偏振镜", "柔光镜", "腕带"], "📷"),
            (&["耳机", "earphone", "headphone", "airpods", "bose", "sony", "降噪", "耳塞", "耳麦", "tws"], "🎧"),
            (&["音箱", "音响", "speaker", "soundlink", "soundtouch", "soundbar", "回音壁", "低音炮", "蓝牙音箱"], "🔊"),
            (&["手表", "watch", "手环", "表带", "galaxy watch", "智能手表", "apple watch"], "⌚"),
            (&["键盘", "keyboard", "k780", "k380", "mx keys", "magic keyboard", "机械键盘", "轴体", "键帽", "客制化"], "⌨️"),
            (&["鼠标", "mouse", "anywhere", "master", "magic mouse", "轨迹球", "触控板"], "🖱️"),
            (&["显示器", "monitor", "屏幕", "ultrafine", "ultrasharp", "4k", "2k", "高刷", "电竞屏", "曲面屏"], "🖥️"),
            (&["充电", "数据线", "cable", "充电器", "适配器", "转接头", "转换器", "otg", "扩展坞", "hub", "排插", "插线板", "插座", "插头", "电源适配器", "pd快充", "氮化镓", "gan"], "🔌"),
            (&["硬盘", "u盘", "存储", "sd卡", "内存卡", "移动硬盘", "固态硬盘", "nas", "ssd", "tf卡", "cf卡", "读卡器"], "💾"),
            (&["电池", "充电宝", "移动电源", "纽扣电池", "充电电池", "锂电池", "干电池"], "🔋"),
            (&["手柄", "方向盘", "racing wheel", "game controller", "摇杆", "游戏手柄"], "🎮"),
            (&["路由", "router", "交换机", "switch", "wifi", "mesh", "ap", "光猫", "网线", "水晶头", "网络面板"], "🌐"),
            (&["麦克风", "microphone", "话筒", "声卡", "录音", "直播设备", "调音台"], "🎙️"),
            (&["打印机", "printer", "扫描仪", "scanner", "投影仪", "projector", "复印机"], "🖨️"),
            (&["摄像头", "webcam", "监控", "门铃", "门锁", "智能锁", "猫眼", "安防"], "📹"),
            (&["主板", "cpu", "处理器", "显卡", "gpu", "内存", "ram", "电源", "机箱", "散热", "风扇", "水冷", "风冷", "rgb", "argb", "防尘塞", "理线"], "🖥️"),
            (&["电子书", "kindle", "电纸书", "阅读器", "boox"], "📖"),
            (&["无人机", "drone", "航拍", "穿越机"], "🛸"),
            (&["钢琴", "电钢琴", "电子琴", "midi键盘", "合成器", "数码钢琴", "px-s", "aps",
               "口笛", "卡祖笛", "kazoo", "口琴", "笛子", "陶笛", "吉他", "尤克里里", "ukulele",
               "小提琴", "架子鼓", "电子鼓", "乐器"], "🎹"),
            (&["数位板", "绘图板", "手绘板", "手写板", "板绘", "画板", "wacom"], "🖊️"),
            (&["辐射", "检测仪", "盖革", "万用表", "示波器", "测距仪", "测温枪", "热成像", "甲醛检测"], "📡"),
            (&["碎纸机", "塑封机", "标签机", "打码机", "考勤机", "点钞机", "验钞机"], "🖨️"),
            (&["蓝牙", "bluetooth", "nfc", "红外", "遥控器", "万能遥控"], "📡"),
        ]},
        CategoryDef { id: "clothing", items: &[
            (&["鞋", "球鞋", "运动鞋", "sneaker", "拖鞋", "凉鞋", "皮鞋", "登山鞋", "crocs", "靴子", "帆布鞋", "板鞋", "跑鞋", "篮球鞋", "洞洞鞋", "高跟鞋", "马丁靴", "雪地靴", "乐福鞋", "豆豆鞋"], "👟"),
            (&["衣服", "上衣", "裤子", "外套", "T恤", "毛衣", "针织", "羊毛", "衬衫", "clothing", "羽绒", "卫衣", "夹克", "马甲", "西装", "风衣", "polo", "卫裤", "短裤", "牛仔裤", "休闲裤", "工装裤", "阔腿裤", "直筒裤", "冲锋衣", "防晒衣", "棉服", "棒球服", "开衫", "帽衫", "羊绒衫", "秋衣", "秋裤", "保暖内衣", "睡衣", "家居服", "浴袍"], "👕"),
            (&["包", "背包", "收纳包", "洗漱包", "bag", "双肩包", "斜挎包", "腰包", "胸包", "公文包", "钱包", "卡包", "帆布袋", "托特包", "腋下包", "饺子包"], "🎒"),
            (&["袜", "内裤", "袜子", "socks", "underwear", "船袜", "中筒袜", "短袜", "长袜", "丝袜", "网袜", "打底裤", "隐形袜", "五指袜", "运动袜"], "🧦"),
            (&["配饰", "项链", "戒指", "手链", "耳环", "手镯", "胸针", "领带", "围巾", "手套", "帽子", "墨镜", "太阳镜", "皮带", "腰带", "发箍", "发夹", "头绳", "发圈", "发带", "耳罩", "棒球帽", "渔夫帽", "贝雷帽", "鸭舌帽"], "💍"),
            (&["箱包", "行李箱", "travel", "登机箱", "拉杆箱", "旅行袋"], "🧳"),
        ]},
        CategoryDef { id: "food", items: &[
            (&["零食", "食品", "饮料", "白酒", "啤酒", "红酒", "米酒", "黄酒", "果酒", "酒水", "洋酒", "清酒", "茶叶", "螺蛳粉", "拉面", "方便面", "饼干", "蛋糕", "面包", "华夫饼",
               "巧克力", "糖果", "坚果", "核桃", "腰果", "开心果", "夏威夷果", "瓜子", "花生", "泡面", "food",
               "咖啡", "coffee", "牛奶", "milk", "果汁", "juice", "豆浆", "酸奶", "麦片", "芝麻糊", "藕粉",
               "牛肉干", "肉脯", "薯片", "锅巴", "海苔", "果冻", "蜜饯", "罐头", "八宝粥", "自热", "速食",
               "凤爪", "鸡爪", "鸭脖", "鸭翅", "卤味", "干锅", "肥牛", "外卖", "矿泉水", "苏打水",
               "意大利面", "意面", "通心粉", "酸辣粉", "热干面", "过桥米线",
               "火腿肠", "腊肉", "腊肠", "香肠", "培根", "午餐肉",
               "麻花", "桃酥", "蛋黄酥", "绿豆糕", "青团", "月饼", "粽子",
               "奶粉", "豆奶", "代餐", "蛋白棒", "能量棒", "黑芝麻",
               "茶包", "红茶", "绿茶", "乌龙茶", "花茶", "普洱茶", "菊花", "枸杞", "红枣",
               // 餐饮外卖/外卖平台/品牌（微信账单常以店名/平台名出现）
               "美团", "饿了么", "袋鼠", "点评", "瑞幸", "luckin", "星巴克", "starbucks", "肯德基", "kfc",
               "麦当劳", "mcdonald", "必胜客", "汉堡王", "德克士", "塔斯汀", "华莱士",
               "喜茶", "奈雪", "蜜雪", "茶百道", "库迪", "coco都可", "古茗", "沪上阿姨", "一点点", "书亦",
               "海底捞", "西贝", "外婆家", "绿茶餐厅", "萨莉亚", "萨利亚", "太二", "探鱼", "呷哺", "呷哺呷哺",
               "捞王", "左庭右院", "老爷锅", "哥老官", "谭鸭血", "大龙燚", "小龙坎", "蜀大侠",
               "奶茶", "柠檬茶", "果茶", "珍珠奶茶", "烧仙草", "杨枝甘露", "甜点", "甜品", "糖水",
               "食堂", "快餐", "小吃", "早餐", "夜宵", "炖品", "砂锅", "麻辣香锅", "日料", "寿司", "刺身",
               "披萨", "pizza", "意式", "汉堡", "薯条", "鸡排", "炸鸡", "烤串", "烧烤", "烤肉", "火锅", "串串",
               "自助餐", "便当", "盒饭", "工作餐", "团购餐", "茶歇", "下午茶", "水果", "生鲜", "蔬菜",
               "鸡蛋", "土鸡蛋", "大米", "面条", "挂面", "米粉", "河粉", "饺子", "馄饨", "包子", "馒头",
               "粽子", "汤圆", "糍粑", "烙饼", "煎饼", "葱油饼", "面点", "点心",
               // 超市/便利店/生鲜（常以店名出现）
               "超市", "便利店", "百货", "永辉", "沃尔玛", "walmart", "大润发", "全家", "罗森", "7-11",
               "喜士多", "美宜佳", "钱大妈", "叮咚", "朴朴", "盒马", "山姆", "costco", "麦德龙", "奥乐齐",
               "便利", "小卖部", "副食", "粮油", "菜市场", "果农", "生鲜超市"], "🍽️"),
            (&["调料", "蘸水", "辣椒面", "调味", "酱油", "醋", "味精", "鸡精", "蚝油", "豆瓣酱", "盐", "糖",
               "生抽", "老抽", "料酒", "芝麻油", "花椒油", "食用油", "橄榄油", "番茄酱", "沙拉酱", "辣酱",
               "火锅底料", "咖喱", "胡椒粉", "孜然", "淀粉", "酵母",
               "麻辣烫", "酸菜鱼", "水煮鱼", "毛血旺", "剁椒", "泡椒", "豆豉", "腐乳", "甜面酱", "芝麻酱", "花生酱"], "🧂"),
        ]},
        CategoryDef { id: "home", items: &[
            (&["家具", "桌子", "椅子", "柜子", "电脑椅", "升降桌", "书桌", "床头柜", "furniture", "茶几", "沙发", "鞋柜", "衣架", "书架"], "🪑"),
            (&["灯具", "灯", "台灯", "吊灯", "夜灯", "氛围灯", "投影灯", "灯泡", "light", "筒灯", "射灯", "灯带", "感应灯"], "💡"),
            (&["清洁", "扫把", "拖把", "吸尘器", "抹布", "洗衣液", "洗衣凝珠", "洁厕", "疏通剂", "洗洁精",
               "消毒液", "洗衣粉", "柔顺剂", "漂白", "除尘", "马桶刷", "玻璃刮", "静电拖把", "洗碗布", "百洁布"], "🧹"),
            (&["纸巾", "抽纸", "湿巾", "面巾纸", "卫生纸", "手帕纸", "卷纸", "餐巾纸", "湿厕纸", "厨房纸", "棉柔巾"], "🧻"),
            (&["收纳", "整理箱", "脏衣篮", "储物箱", "储物盒", "收纳架", "置物架", "抽屉", "分隔盒", "压缩袋"], "🗃️"),
            (&["床单", "被套", "枕套", "床垫", "凉席", "被子", "毯子", "四件套", "三件套", "枕巾", "蚊帐", "床笠", "乳胶枕"], "🛏️"),
            (&["水杯", "保温杯", "马克杯", "运动水杯", "水壶", "水瓶", "tritan", "玻璃杯", "咖啡杯", "随行杯", "吸管杯", "冷水壶"], "🥤"),
            (&["挂钩", "挂架", "粘钩", "门后挂钩", "挂衣钩", "挂衣架", "免打孔", "置物挂钩", "拖把夹"], "🪝"),
            (&["雨伞", "遮阳伞", "太阳伞", "雨衣", "雨鞋", "雨披"], "☂️"),
            (&["香薰", "香氛", "香膏", "香薰机", "扩香", "香薰蜡烛", "精油", "藤条", "无火香薰", "车载香薰"], "🕯️"),
            (&["垃圾桶", "垃圾袋", "背心垃圾袋", "分类垃圾桶", "智能垃圾桶"], "🗑️"),
            (&["除湿", "干燥剂", "防潮", "吸湿", "除湿机", "除湿器", "加湿器", "加湿", "湿度计"], "💧"),
            (&["驱蚊", "花露水", "蚊香", "电蚊香", "灭蚊", "驱蚊液", "驱蚊器", "蚊帐", "止痒"], "🦟"),
            (&["刀具", "瑞士军刀", "水果刀", "菜刀", "厨刀", "剪刀", "美工刀", "陶瓷刀", "削皮器", "磨刀石"], "🔪"),
            (&["工具", "维修", "钳子", "螺丝刀", "扳手", "tool", "卷尺", "电钻", "锤子", "胶带", "胶水", "电烙铁", "打火机"], "🔧"),
            (&["植物", "花", "多肉", "绿植", "盆栽", "土", "种子", "花卉", "园艺", "花盆", "营养土", "肥料", "浇水壶"], "🌵"),
            (&["坐垫", "靠垫", "腰靠", "坐姿椅", "护腰", "坐垫套", "椅套"], "🪑"),
            (&["抽水器", "压水器", "桶装水", "抽水泵", "饮水机"], "🪣"),
            (&["窗帘", "百叶窗", "卷帘", "罗马帘", "纱帘"], "🪟"),
            (&["镜子", "化妆镜", "全身镜", "壁挂镜", "放大镜"], "🪞"),
            (&["电子秤", "体重秤", "体脂秤", "厨房秤"], "⚖️"),
            (&["锅", "不粘锅", "炒锅", "煎锅", "奶锅", "汤锅", "雪平锅", "蒸锅", "铁锅", "珐琅锅", "平底锅",
               "空气炸锅", "高压锅", "电饭煲", "电压力锅", "锅铲", "锅盖", "锅具"], "🍳"),
            (&["碗", "盘子", "餐盘", "碟子", "餐具", "饭碗", "骨瓷", "牛排盘", "沙拉盘", "筷子", "勺子", "叉子",
               "碗筷", "筷笼", "筷架", "刀叉", "砧板", "切菜板", "菜板"], "🍽️"),
            (&["毛巾", "浴巾", "方巾", "面巾", "手巾", "干发帽", "束发带"], "🧻"),
            (&["地垫", "地毯", "门垫", "浴室垫", "厨房垫", "脚垫", "进门垫"], "🏠"),
            (&["浴室架", "毛巾架", "纸巾架", "马桶垫", "马桶刷", "地漏", "防滑垫"], "🚿"),
            (&["洗衣袋", "洗衣球", "晾衣架", "熨斗", "烫衣板", "毛球修剪器", "粘毛器", "晒衣架"], "🧺"),
            (&["风扇", "取暖器", "电热毯", "暖手宝", "热水袋", "空气净化器", "净水器", "滤水壶", "空净"], "⚡"),
            (&["螺丝", "钉子", "膨胀管", "扎带", "理线器", "束线带", "热缩管", "绝缘胶带", "生料带", "磁铁", "磁片"], "🔧"),
            (&["墙纸", "墙贴", "壁画", "装饰画", "相框", "时钟", "闹钟", "挂钟", "数字油画"], "🖼️"),
            (&["浴球", "沐浴球", "搓澡巾", "浴帽", "浴帘", "置物架", "三角篮"], "🛁"),
            (&["密封条", "门窗密封", "防风条", "隔音条", "防撞条", "门底密封"], "🚪"),
            (&["卡套", "公交卡套", "门禁卡", "卡包", "证件套", "行李牌", "卡贴"], "💳"),
            (&["橱柜", "灶台", "台面", "厨房装修", "洗手盆", "水槽", "油烟机", "燃气灶", "消毒柜", "洗碗机", "集成灶"], "🍳"),
        ]},
        CategoryDef { id: "beauty", items: &[
            (&["美容", "化妆", "护肤", "面膜", "精华", "粉底", "口红", "防晒", "脱毛", "beauty", "眼霜",
               "面霜", "乳液", "隔离", "散粉", "腮红", "眼影", "眉笔", "睫毛膏", "卸妆", "bb霜", "cc霜",
               "气垫", "遮瑕", "高光", "修容", "定妆", "妆前乳", "素颜霜", "爽肤水", "精粹水", "收敛水"], "💄"),
            (&["洗发", "沐浴", "洗面奶", "洗手液", "香皂", "肥皂", "牙膏", "牙线", "牙签", "漱口水",
               "洗护", "沐浴露", "身体乳", "护手霜", "磨砂膏", "浴盐", "私处护理", "私处洗液",
               "浴球", "搓澡巾", "浴帽", "棉签", "化妆棉", "洗脸巾", "起泡网", "起泡器"], "🧴"),
            (&["发胶", "发蜡", "发泥", "发油", "定型", "喷雾", "啫喱", "发膜", "护发素", "弹力素", "染发", "烫发"], "💇"),
            (&["香水", "perfume", "香奈儿", "chanel", "dior", "古龙水", "淡香水", "香精", "小样"], "🌸"),
            (&["剃须", "剃须刀", "刮胡刀", "刀片", "剃须泡沫", "电动剃须", "吉列", "飞利浦"], "🪒"),
            (&["美甲", "指甲油", "甲油胶", "卸甲", "指甲刀", "指甲锉", "美甲灯"], "💅"),
        ]},
        CategoryDef { id: "game", items: &[
            (&["游戏", "steam", "switch", "ps5", "xbox", "手柄", "game", "sim", "simulator", "simulation",
               "warfare", "souls", "ring", "shooter", "racing", "horizon", "driver", "flight", "fantasy",
               "survival", "battlefield", "combat", "hunter", "sniper", "video game", "rpg", "fps", "moba",
               "dlc", "expansion", "season pass", "原神", "黑神话", "悟空",
               "守望", "overwatch", "斗阵", "cod", "使命召唤", "侠盗", "gta", "大镖客", "刺客信条",
               "赛博朋克", "巫师", "apex", "valorant", "lol", "dota", "csgo", "pubg",
               "unity", "unity3d", "shader", "stylized", "urp", "hdrp", "blueprint",
               "psn", "xgp", "xbox game pass", "ea play", "ubisoft"], "🎮"),
            (&["玩具", "手办", "模型", "盲盒", "乐高", "lego", "积木", "公仔", "玩偶", "娃娃",
               "遥控", "rc", "航模", "教练机", "无人机", "车模", "船模", "拼图", "魔方"], "🎮"),
            (&["电影", "movie", "票", "电影院", "话剧", "演唱会", "展览", "博物馆", "演出"], "🎬"),
            (&["动漫", "贴纸", "金属贴纸", "徽章", "挂件", "立牌", "吧唧", "谷子", "痛包", "亚克力"], "🦸"),
        ]},
        CategoryDef { id: "health", items: &[
            (&["运动", "健身", "瑜伽", "跑步", "哑铃", "跳绳", "sport", "运动服", "运动裤", "蛋白粉",
               "肌酸", "护具", "护膝", "护腕", "护踝", "护肘", "拉伸带", "瑜伽垫", "泡沫轴", "筋膜枪",
               "运动手表", "心率带", "跑鞋", "篮球", "足球", "羽毛球", "乒乓球", "网球", "游泳",
               "露营", "野外", "口哨", "求生", "救生", "登山", "徒步", "帐篷", "睡袋", "防潮垫",
               "头灯", "指南针", "登山杖", "急救包", "户外装备", "速干衣"], "🏃"),
            (&["药", "药物", "医", "口罩", "滴眼液", "眼药水", "胶囊", "颗粒", "氯雷他定", "红霉素",
               "创可贴", "绷带", "感冒药", "退烧药", "止咳", "消炎", "止痛", "肠胃", "维生素", "钙片",
               "鱼油", "褪黑素", "益生菌", "酒精", "碘伏", "棉签", "温度计", "血压计", "血糖仪",
               "鼻", "眼罩", "眼贴", "护眼", "爽身粉", "止汗", "痱子", "小苏打", "碳酸氢钠",
               "血氧仪", "雾化器", "轮椅", "拐杖", "护颈", "蒸汽眼罩", "洗眼液", "隐形眼镜", "护理液",
               "洗鼻器", "止鼾", "耳塞", "助眠", "安神"], "💊"),
            (&["自行车", "骑行", "山地车", "公路车", "bike", "bicycle", "单车", "车灯", "车锁",
               "脚踏", "链条", "坐垫", "鞍座", "头盔", "打气筒", "骑行服", "码表", "水壶架", "脚撑"], "🚲"),
        ]},
        CategoryDef { id: "stationery", items: &[
            (&["书", "教材", "book", "考研", "托福", "雅思", "gre", "英语", "日语", "小说", "文学",
               "编程", "java", "python", "算法", "数据结构", "操作系统", "计算机网络", "编译原理",
               "深度学习", "机器学习", "ai", "人工智能", "设计模式", "重构", "架构", "教程", "自学"], "📚"),
            (&["文具", "笔", "记号笔", "马克笔", "水彩", "颜料", "画笔", "pen", "墨水", "钢笔",
               "圆珠笔", "铅笔", "橡皮", "尺子", "圆规", "计算器", "修正带", "荧光笔", "中性笔", "签字笔",
               "素描", "速写", "宣纸", "毛笔", "砚台", "墨汁", "调色盘", "画架", "画框", "速写本",
               "胶水", "胶棒", "订书机", "订书钉", "打孔器", "回形针", "图钉", "长尾夹", "推夹器"], "✏️"),
            (&["打印耗材", "pla", "热端", "喷嘴", "打印相纸", "pla basic", "pla matte", "3d打印",
               "拓竹", "bambu", "树脂", "光固化", "fdm", "打印平台"], "🖨️"),
            (&["笔记本", "notepad", "便签", "便利贴", "手账", "日记本", "活页本", "日程本", "计划本"], "📓"),
            (&["文件夹", "档案盒", "风琴包", "资料册", "拉链袋", "文件架"], "📁"),
        ]},
        CategoryDef { id: "auto", items: &[
            (&["汽车", "车载", "行车记录仪", "机油", "轮胎", "car", "座垫", "脚垫", "洗车", "车蜡",
               "玻璃水", "防冻液", "雨刮器", "车载充电", "安全座椅", "手机支架", "车载支架",
               "车牌框", "牌照框", "屏幕钢化膜", "仪表膜", "出风口", "防踢垫", "门槛条",
               "后备箱垫", "遮阳挡", "车衣", "方向盘套", "头枕", "腰靠", "香片", "挪车牌", "etc",
               "倒车影像", "雷达", "导航", "gps", "车载吸尘器", "应急电源", "搭电线", "拖车绳", "充气泵"], "🚗"),
            (&["摩托车", "motorcycle", "骑行装备", "骑行服", "护膝护肘", "蓝牙耳机", "胎压监测"], "🏍️"),
        ]},
        CategoryDef { id: "pet", items: &[
            (&["猫", "狗", "宠物", "猫粮", "狗粮", "猫砂", "仓鼠", "兔子", "pet", "鱼粮", "鱼缸",
               "观赏鸟", "宠物鸟", "小鸟", "鹦鹉", "鸟食", "龟", "爬虫", "猫抓板", "逗猫棒", "猫零食", "狗零食", "尿垫",
               "猫砂盆", "狗窝", "猫窝", "牵引绳", "胸背带", "项圈", "驱虫药", "化毛膏", "观赏鱼", "热带鱼", "金鱼", "水族",
               "猫条", "猫罐头", "冻干", "营养膏", "猫薄荷", "猫爬架", "自动喂食器", "猫包", "航空箱"], "🐾"),
        ]},
        CategoryDef { id: "life", items: &[
            (&["滴滴", "didi", "出租车", "打的", "网约车", "打车", "快车", "专车", "顺风车",
               "地铁", "公交", "乘车码", "轻轨", "高铁", "动车", "火车", "火车票", "12306",
               "机票", "航空", "航班", "机场", "候机",
               "共享单车", "哈啰", "青桔", "美团单车", "停车", "代驾", "高速费", "过路费", "etc收费"],
             "🚕"),
            (&["上海石化", "中国石化", "中国石油", "中石化", "中石油", "加油站", "加油", "壳牌", "道达尔",
               "油卡", "燃油", "加油卡"], "⛽"),
            (&["话费", "手机充值", "流量充值", "流量包", "中国移动", "中国联通", "中国电信", "电信",
               "联通", "移动充值", "固话", "宽带", "网费", "wifi充值", "流量月包"], "📱"),
            (&["水费", "电费", "燃气费", "水电", "水费缴纳", "电费缴纳", "煤气", "煤气费", "物业费",
               "物业", "房租", "供暖", "暖气费", "有线电视", "数字电视", "天燃气"], "💧"),
            (&["挂号", "门诊", "医院", "诊所", "就医", "体检", "化验", "药房", "药店", "大药房",
               "国大药房", "同仁堂", "疾病", "预约挂号"], "🏥"),
            (&["酒店", "民宿", "客栈", "宾馆", "旅馆", "青旅", "度假村", "旅行", "旅游", "景点",
               "门票", "景区", "旅行社", "出游", "跟团", "一日游"], "🏨"),
            (&["理发", "剪发", "美发", "烫发", "染发", "造型", "美容院", "spa", "洗剪吹", "理发店"], "✂️"),
            (&["学费", "培训", "网课", "辅导", "补习", "兴趣班", "自习室", "驾校", "学车", "课程",
               "教育", "报名费", "考试费", "雅思", "托福", "考研"], "🎓"),
            (&["ktv", "KTV", "足浴", "按摩", "足疗", "spa按摩", "洗浴", "泡汤", "温泉", "酒吧",
               "桌球", "台球", "游乐场", "剧本杀", "密室", "网吧", "电玩城", "游戏厅"], "🎤"),
            (&["快递", "菜鸟", "驿站", "顺丰", "中通", "圆通", "韵达", "申通", "极兔", "京东物流",
               "德邦", "邮政", "ems", "运费", "寄件", "收件", "快递柜", "丰巢"], "📦"),
        ]},
        CategoryDef { id: "other", items: &[
            (&["避孕套", "情趣", "成人", "sex", "自慰", "润滑", "安全套", "情趣内衣", "sm", "肛塞"], "📦"),
            (&["礼品卡", "购物卡", "充值", "点卡", "会员", "订阅", "vip", "虚拟商品", "增值服务",
               "运费险", "赠品", "服务费", "保修",
               "激活码", "密钥", "序列号", "密匙", "秘钥", "注册码", "license",
               "代充", "代购", "查题", "扩容", "云盘", "卡密", "补差价", "补邮费"], "🎫"),
            (&["洗照片", "冲印", "打印照片", "证件照"], "🖼️"),
        ]},
    ];

    let lower_name = name.to_lowercase();
    let lower_store = store.to_lowercase();
    let combined = format!("{} {} {}", lower_name, lower_store, platform);

    for category in CATEGORY_MAP {
        for (keys, emoji) in category.items {
            for key in *keys {
                if combined.contains(key) {
                    return (category.id, emoji);
                }
            }
        }
    }
    ("other", "📦")
}

// ── CSV 解析 ──────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct CsvRecord {
    #[serde(rename = "订单编号")]
    order_id: Option<String>,
    #[serde(rename = "父订单编号")]
    parent_order_id: Option<String>,
    #[serde(rename = "商品编号")]
    product_id: Option<String>,
    #[serde(rename = "店铺名称")]
    store_name: Option<String>,
    #[serde(rename = "商品名称")]
    product_name: Option<String>,
    #[serde(rename = "商品数量")]
    quantity: Option<String>,
    #[serde(rename = "实付金额")]
    paid_amount: Option<String>,
    #[serde(rename = "商品总价")]
    total_price: Option<String>,
    #[serde(rename = "付款时间")]
    pay_time: Option<String>,
    #[serde(rename = "下单时间")]
    order_time: Option<String>,
    #[serde(rename = "型号款式")]
    model_style: Option<String>,
    #[serde(rename = "导出批次")]
    import_batch: Option<String>,
    #[serde(rename = "订单状态")]
    order_status: Option<String>,
    #[serde(rename = "商品链接")]
    product_link: Option<String>,
    #[serde(rename = "商品明细JSON")]
    product_detail_json: Option<String>,
}

/// 将 \n 分隔的多值字段拆分为数组，用于展开多商品订单
fn split_lines(s: &str) -> Vec<&str> {
    s.split('\n').map(|v| v.trim()).filter(|v| !v.is_empty()).collect::<Vec<_>>()
}

/// 从京东商品明细JSON中提取匹配商品名称的链接
fn extract_jd_product_url(json_str: &str, target_name: &str) -> String {
    if json_str.is_empty() || target_name.is_empty() {
        return String::new();
    }
    // 解析 JSON 数组
    if let Ok(items) = serde_json::from_str::<Vec<serde_json::Value>>(json_str) {
        for item in &items {
            if let Some(name) = item.get("商品名称").and_then(|v| v.as_str()) {
                if name == target_name {
                    return item
                        .get("商品链接")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string();
                }
            }
        }
    }
    String::new()
}

// ── Steam CSV ─────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct SteamCsvRecord {
    #[serde(rename = "交易ID")]
    transaction_id: Option<String>,
    #[serde(rename = "日期")]
    date: Option<String>,
    #[serde(rename = "物品名称")]
    product_name: Option<String>,
    #[serde(rename = "类型")]
    order_type: Option<String>,
    #[serde(rename = "总计")]
    total: Option<String>,
    #[serde(rename = "导出批次")]
    import_batch: Option<String>,
}

fn parse_steam_csv_content(content: &str, _file_name: &str, conn: &Connection) -> Result<ImportResult, String> {
    let mut reader = csv::Reader::from_reader(content.as_bytes());

    // ── 校验必需列头（避免列名变化时静默全跳过）──
    let headers = reader.headers().cloned().map_err(|e| format!("读取 CSV 列头失败: {}", e))?;
    let missing = validate_csv_headers(&headers, &["交易ID", "物品名称"]);
    if !missing.is_empty() {
        return Err(format!("Steam CSV 缺少必需列: {}（请使用浏览器扩展导出的标准文件）", missing.join("、")));
    }

    // ── 批量预加载已有 Steam 订单 ID（一次 SQL 替代逐行 COUNT(*) 查询）──
    let mut steam_dedup: HashSet<String> = HashSet::new();
    {
        let mut stmt = conn
            .prepare("SELECT order_id FROM orders WHERE platform='steam'")
            .map_err(|e| format!("预加载 Steam 去重键失败: {}", e))?;
        let rows = stmt
            .query_map([], |row| row.get::<_, String>(0))
            .map_err(|e| e.to_string())?;
        for row in rows {
            if let Ok(oid) = row {
                steam_dedup.insert(oid);
            }
        }
    }

    // ── 两遍扫描：先收集全部记录 + 各交易 ID 的退款总额 ──
    // Steam 对"购买后退款"会导出两行（原购买行 + 退款行）。整单退款（页面带
    // wht_refunded 标记）购买行与退款行金额相等，应整体跳过；部分退款（如同一
    // 订单里仅部分物品被退）购买行金额大于退款行，应保留净额。因此先按交易 ID
    // 汇总退款金额，第二遍以"购买额 - 退款额"的净额入库：净额 ≤ 0 跳过，> 0 导入。
    let mut records: Vec<SteamCsvRecord> = Vec::new();
    let mut refund_by_id: HashMap<String, f64> = HashMap::new();
    let mut invalid: usize = 0;
    for result in reader.deserialize::<SteamCsvRecord>() {
        match result {
            Ok(record) => {
                let tid = record.transaction_id.clone().unwrap_or_default().trim().to_string();
                if !tid.is_empty()
                    && record.order_type.clone().unwrap_or_default().trim() == "退款"
                {
                    let amt = record.total.clone().unwrap_or_default().trim().parse().unwrap_or(0.0);
                    *refund_by_id.entry(tid).or_insert(0.0) += amt;
                }
                records.push(record);
            }
            Err(_) => invalid += 1,
        }
    }

    // ── 事务包裹：整文件原子导入，失败自动回滚，避免逐行提交拖慢性能 ──
    let tx = conn.unchecked_transaction().map_err(|e| format!("开启事务失败: {}", e))?;

    let mut imported: usize = 0;
    let mut skipped: usize = invalid;

    for record in records {
        let transaction_id = record.transaction_id.unwrap_or_default().trim().to_string();
        if transaction_id.is_empty() {
            skipped += 1;
            continue;
        }

        // 跳过退款
        let order_type = record.order_type.unwrap_or_default().trim().to_string();
        if order_type == "退款" {
            skipped += 1;
            continue;
        }

        let product_name = record.product_name.unwrap_or_default().trim().to_string();
        if product_name.is_empty() || product_name == "物品名称" {
            skipped += 1;
            continue;
        }

        // 跳过钱包充值（"已购买 XX 钱包资金"）——充值不是购买物品，避免与后续钱包消费重复计入
        if is_wallet_topup(&product_name) {
            skipped += 1;
            continue;
        }

        // 日期转换
        let raw_date = record.date.unwrap_or_default();
        let order_time = normalize_date(&raw_date.trim());
        // 首条记录日志，便于排查日期解析问题
        if imported == 0 {
            log::info!("[DailyCost] Steam 首条: 原始日期='{}' 归一化='{}'", raw_date.trim(), order_time);
        }

        // 总计
        let total_price: f64 = record
            .total
            .unwrap_or_default()
            .trim()
            .parse()
            .unwrap_or(0.0);

        // 跳过零价格（如货币转换等无金额行）
        if total_price <= 0.0 {
            skipped += 1;
            continue;
        }

        // 净额 = 购买金额 - 该交易退款总额
        // 整单退款 → 净额 0，跳过；部分退款（同订单仅部分物品被退）→ 保留净额
        let net_price = total_price - refund_by_id.get(&transaction_id).copied().unwrap_or(0.0);
        if net_price <= 0.0 {
            skipped += 1;
            continue;
        }

        let import_batch = format!("Steam · {}", record.import_batch.unwrap_or_default().trim());
        let platform = "steam";
        let (category, emoji) = match_product_category(&product_name, "", platform);

        // 去重（内存 HashSet 比对）
        if steam_dedup.contains(&transaction_id) {
            skipped += 1;
            continue;
        }

        tx.execute(
            "INSERT INTO orders (order_id, parent_order_id, platform, store_name, product_name, model_style, quantity, total_price, order_time, import_batch, product_url, emoji, end_date, end_reason, sell_price, category)
             VALUES (?1, '', ?2, '', ?3, '', 1, ?4, ?5, ?6, '', ?7, '', '', 0, ?8)",
            params![
                transaction_id,
                platform,
                product_name,
                net_price,
                order_time,
                import_batch,
                emoji,
                category,
            ],
        )
        .map_err(|e| format!("数据库插入失败: {}", e))?;

        // 同步更新去重缓存
        steam_dedup.insert(transaction_id);
        imported += 1;
    }

    tx.commit().map_err(|e| format!("提交事务失败: {}", e))?;

    Ok(ImportResult {
        success: true,
        imported,
        skipped,
        message: format!(
            "成功导入 {} 条，跳过 {} 条（退款/整单退款/钱包充值/重复/无效）\n平台: Steam | 文件名: {}",
            imported, skipped, _file_name
        ),
    })
}

/// 判断是否为 Steam 钱包充值记录（"已购买 XX 钱包资金"）——非物品购买，不计入总花费
fn is_wallet_topup(product_name: &str) -> bool {
    product_name.contains("钱包资金")
}

// ── 微信账单 ────────────────────────────────────────────
// 微信个人账单流水（CSV/xlsx）前 5 行是元数据（微信支付账单明细/昵称/起止时间/导出时间/分隔线），
// 表头与数据从第 6 行开始。列结构天然可映射进 orders 表 17 列，无需改表结构。
// 列：交易时间, 交易类型, 交易对方, 商品, 收/支, 金额(元), 支付方式, 当前状态, 交易单号, 商户单号, 备注

/// 微信账单必需/可选的列定位（xlsx 与 csv 共用）
#[derive(Default)]
struct WechatCols {
    time: Option<usize>,
    peer: Option<usize>,
    product: Option<usize>,
    income_expense: Option<usize>,
    amount: Option<usize>,
    pay_method: Option<usize>,
    status: Option<usize>,
    order_id: Option<usize>,
    merchant_id: Option<usize>,
    remark: Option<usize>,
    tx_type: Option<usize>,   // 交易类型（退款/转账/红包等，收入行用于区分回款来源）
}

impl WechatCols {
    /// 从表头行定位各微信列；返回是否定位到必需列（交易单号 + 金额）
    fn from_row(header: &[String]) -> (Self, bool) {
        let mut cols = WechatCols::default();
        for (i, h) in header.iter().enumerate() {
            let h = h.trim();
            let _ = match h {
                "交易时间" => cols.time = Some(i),
                "交易对方" => cols.peer = Some(i),
                "商品" => cols.product = Some(i),
                "收/支" => cols.income_expense = Some(i),
                "交易类型" => cols.tx_type = Some(i),
                "金额(元)" => cols.amount = Some(i),
                "支付方式" => cols.pay_method = Some(i),
                "当前状态" => cols.status = Some(i),
                "交易单号" => cols.order_id = Some(i),
                "商户单号" => cols.merchant_id = Some(i),
                "备注" => cols.remark = Some(i),
                _ => {}
            };
        }
        let ok = cols.order_id.is_some() && cols.amount.is_some();
        (cols, ok)
    }

    fn cell<'a>(&self, row: &'a [String], idx: Option<usize>) -> &'a str {
        idx.and_then(|i| row.get(i)).map(|s| s.trim()).unwrap_or("")
    }
}

/// 微信账单状态白名单（`/`=未知状态；异常/退款等不导入）。
/// `已转账`/`对方已收钱` 为扫二维码付款/转账等非购物流水的完成态（钱已付出），须放行保留
fn is_valid_wechat_status(status: &str) -> bool {
    matches!(status, "" | "/" | "支付成功" | "已支付" | "交易成功" | "完成" | "已转账" | "对方已收钱")
}

/// 微信收入状态排除白名单：仅跳过明显失败/未完成/冻结的流水。
/// 收入行多为 AA 转账回款/退款/红包等，状态值多样（已收款/对方已收钱/已退款等），
/// 故采用"排除法"而非严格白名单，避免把有效回款漏导入
fn is_invalid_wechat_income_status(status: &str) -> bool {
    matches!(status, "交易失败" | "支付失败" | "已关闭" | "已撤销" | "已冻结" | "失败")
}

/// 解析微信金额：兼容 `¥25.50`、`¥ 25.50`、千分位 `1,234.56` 等格式；解析失败返回 0
fn parse_wechat_amount(raw: &str) -> f64 {
    let cleaned: String = raw.chars().filter(|c| c.is_ascii_digit() || *c == '.' || *c == '-').collect();
    cleaned.parse().unwrap_or(0.0)
}

/// 将 Excel 日期序列号（如 "46222.8"）转换为 ISO 日期字符串 "YYYY-MM-DD HH:MM:SS"。
/// 微信账单 xlsx 的"交易时间"列常存为数字序列号（Excel 1900 日期系统，epoch=1899-12-30）。
/// 非纯数字（已归一化的日期字符串）原样返回，交由 normalize_date 处理。
fn wechat_date_to_iso(raw: &str) -> String {
    let t = raw.trim();
    if t.is_empty() {
        return String::new();
    }
    // 仅全为数字/小数点/负号时才视为 Excel 日期序列号
    if t.chars().all(|c| c.is_ascii_digit() || c == '.' || c == '-') {
        if let Ok(serial) = t.parse::<f64>() {
            // Excel 1900 日期系统：epoch = 1899-12-30（规避 1900 闰年 bug）
            if let Some(epoch) = chrono::NaiveDate::from_ymd_opt(1899, 12, 30) {
                let days = serial.floor().max(0.0) as i64;
                let secs = ((serial - serial.floor()) * 86400.0).round() as i64;
                if let Some(date) = epoch.checked_add_days(chrono::Days::new(days as u64)) {
                    let h = (secs / 3600) % 24;
                    let m = (secs / 60) % 60;
                    let s = secs % 60;
                    return format!(
                        "{} {:02}:{:02}:{:02}",
                        date.format("%Y-%m-%d"), h, m, s
                    );
                }
            }
        }
    }
    t.to_string()
}

/// 微信账单核心解析：输入任意来源的二维数组（CSV 或 xlsx），统一映射入库
fn parse_wechat_rows(rows: &[Vec<String>], file_name: &str, conn: &Connection) -> Result<ImportResult, String> {
    // 定位表头行（跳过前 5 行元数据，至多扫描前 200 行）
    let mut header_idx: Option<usize> = None;
    let mut cols = WechatCols::default();
    for (i, row) in rows.iter().enumerate().take(200) {
        let (c, ok) = WechatCols::from_row(row);
        if ok { header_idx = Some(i); cols = c; break; }
    }
    let Some(header_idx) = header_idx else {
        return Err(format!("未找到微信账单表头（需含「交易单号」「金额(元)」列），请确认文件为微信支付账单流水"));
    };

    // ── 批量预加载已有微信交易单号（一次 SQL 替代逐行 COUNT(*)）──
    let mut wx_dedup: HashSet<String> = HashSet::new();
    {
        let mut stmt = conn.prepare("SELECT order_id FROM orders WHERE platform='wx'")
            .map_err(|e| format!("预加载微信去重键失败: {}", e))?;
        let r = stmt.query_map([], |row| row.get::<_, String>(0)).map_err(|e| e.to_string())?;
        for row in r { if let Ok(oid) = row { wx_dedup.insert(oid); } }
    }

    // ── 批量预加载已有微信收入交易单号（收入与支出单号互不冲突，独立去重）──
    let mut income_dedup: HashSet<String> = HashSet::new();
    {
        let mut stmt = conn.prepare("SELECT order_id FROM income_records")
            .map_err(|e| format!("预加载微信收入去重键失败: {}", e))?;
        let r = stmt.query_map([], |row| row.get::<_, String>(0)).map_err(|e| e.to_string())?;
        for row in r { if let Ok(oid) = row { income_dedup.insert(oid); } }
    }

    // ── 事务包裹：整文件原子导入，失败自动回滚 ──
    let tx = conn.unchecked_transaction().map_err(|e| format!("开启事务失败: {}", e))?;

    let mut imported: usize = 0;
    let mut income_imported: usize = 0;
    let mut skipped: usize = 0;

    for row in rows.iter().skip(header_idx + 1) {
        if row.is_empty() {
            skipped += 1; continue;
        }
        let order_id = cols.cell(row, cols.order_id);
        if order_id.is_empty() {
            skipped += 1; continue;
        }
        // 收/支分流：支出 → orders 物品表；收入（AA 转账回款/退款/红包等）→ income_records 回款表
        // 收入独立存放，不参与在库资产/月度消费等分析，避免污染"个人消费"口径
        let income_expense = cols.cell(row, cols.income_expense);
        if income_expense == "收入" {
            // 收入行状态值多样（已收款/对方已收钱/已退款等），采用排除法仅跳过明显失败/未完成流水
            let status = cols.cell(row, cols.status);
            if is_invalid_wechat_income_status(status) {
                skipped += 1; continue;
            }
            let amount = parse_wechat_amount(cols.cell(row, cols.amount)).abs();
            if amount <= 0.0 { skipped += 1; continue; }
            if income_dedup.contains(order_id) { skipped += 1; continue; }

            let time_str = wechat_date_to_iso(cols.cell(row, cols.time));
            let order_time = normalize_date(&time_str);
            let import_batch = format!("微信 · {}", file_name);

            tx.execute(
                "INSERT INTO income_records (order_id, platform, peer, income_type, amount, order_time, status, import_batch)
                 VALUES (?1, 'wx', ?2, ?3, ?4, ?5, ?6, ?7)",
                params![
                    order_id,
                    cols.cell(row, cols.peer),
                    cols.cell(row, cols.tx_type),
                    amount,
                    order_time,
                    status,
                    import_batch,
                ],
            ).map_err(|e| format!("收入记录插入失败: {}", e))?;

            income_dedup.insert(order_id.to_string());
            income_imported += 1;
            continue;
        }
        // 仅导入支出流水（不计收支/`/` 跳过）
        if !matches!(income_expense, "支出") {
            skipped += 1; continue;
        }
        // 状态白名单（退款/异常等跳过）
        let status = cols.cell(row, cols.status);
        if !is_valid_wechat_status(status) {
            skipped += 1; continue;
        }

        // 商品名回退到交易对方
        let product_name = cols.cell(row, cols.product).to_string();
        let product_name = if product_name.is_empty() || product_name == "/" {
            cols.cell(row, cols.peer).to_string()
        } else { product_name };
        if product_name.is_empty() {
            skipped += 1; continue;
        }

        // 金额取绝对值（支出流水金额为正；取绝对值防个别负值；兼容 ¥/千分位格式）
        let amount = parse_wechat_amount(cols.cell(row, cols.amount)).abs();
        if amount <= 0.0 { skipped += 1; continue; }
        if wx_dedup.contains(order_id) { skipped += 1; continue; }

        // 支付方式 + 备注合并到型号区
        let mut remark = cols.cell(row, cols.remark).to_string();
        if remark == "/" { remark.clear(); }
        let pay_method = cols.cell(row, cols.pay_method);
        let model_style = if remark.is_empty() { pay_method.to_string() }
            else if pay_method.is_empty() || pay_method == "/" { remark }
            else { format!("{}\n{}", pay_method, remark) };

        let (category, emoji) = match_product_category(&product_name, cols.cell(row, cols.peer), "wx");
        let import_batch = format!("微信 · {}", file_name);

        // 交易时间：xlsx 中"交易时间"列可能是 Excel 日期序列号（数字，如 46222.8），需先转换为日期
        let time_str = wechat_date_to_iso(cols.cell(row, cols.time));
        let order_time = normalize_date(&time_str);

        tx.execute(
            "INSERT INTO orders (order_id, parent_order_id, product_id, platform, store_name, product_name, model_style, quantity, total_price, order_time, import_batch, product_url, emoji, end_date, end_reason, sell_price, category)
             VALUES (?1, '', ?2, 'wx', ?3, ?4, ?5, 1, ?6, ?7, ?8, '', ?9, '', '', 0, ?10)",
            params![
                order_id,
                cols.cell(row, cols.merchant_id),
                cols.cell(row, cols.peer),
                product_name,
                model_style,
                amount,
                order_time,
                import_batch,
                emoji,
                category,
            ],
        ).map_err(|e| format!("数据库插入失败: {}", e))?;

        wx_dedup.insert(order_id.to_string());
        imported += 1;
    }

    tx.commit().map_err(|e| format!("提交事务失败: {}", e))?;

    Ok(ImportResult {
        success: true,
        imported,
        skipped,
        message: format!(
            "成功导入 {} 条支出、{} 条收入（回款），跳过 {} 条（重复/无效/不计收支）\n平台: 微信 | 文件名: {}",
            imported, income_imported, skipped, file_name
        ),
    })
}

/// 从微信 CSV 文本导入（复用统一的二维数组解析）
fn parse_wechat_csv_content(content: &str, file_name: &str, conn: &Connection) -> Result<ImportResult, String> {
    let mut rows: Vec<Vec<String>> = Vec::new();
    let mut reader = csv::ReaderBuilder::new()
        .flexible(true)   // 微信账单列数不固定（部分列可能为空）
        .from_reader(content.as_bytes());
    for result in reader.records() {
        if let Ok(rec) = result {
            rows.push(rec.iter().map(|s| s.to_string()).collect());
        }
    }
    // 表头校验放到 parse_wechat_rows（其会扫描定位表头），此处透传文件名
    parse_wechat_rows(&rows, file_name, conn)
}

/// 从微信 xlsx 字节导入（桌面端 .xlsx 与 Android content:// URI 场景）
fn parse_wechat_xlsx_content(data: &[u8], file_name: &str, conn: &Connection) -> Result<ImportResult, String> {
    use calamine::{Reader, Xlsx};
    let mut workbook = Xlsx::new(std::io::Cursor::new(data))
        .map_err(|e| format!("无法解析 xlsx 文件: {}", e))?;
    // 选第一个含微信表头的 sheet
    let mut rows: Vec<Vec<String>> = Vec::new();
    let mut found_header = false;
    for sheet_name in workbook.sheet_names().to_vec() {
        if let Ok(range) = workbook.worksheet_range(&sheet_name) {
            let mut candidate: Vec<Vec<String>> = Vec::new();
            let mut header_found = false;
            // 边转换边判断表头（前 200 行内命中即保留全部行）
            for r in range.rows() {
                let line: Vec<String> = r.iter().map(|c| c.to_string()).collect();
                if !header_found && candidate.len() < 200 {
                    let (_, ok) = WechatCols::from_row(&line);
                    if ok { header_found = true; }
                }
                candidate.push(line);
            }
            if header_found {
                rows = candidate;
                found_header = true;
                break;
            }
        }
    }
    if !found_header {
        return Err("xlsx 中未找到微信账单表头（需含「交易单号」「金额(元)」列）".to_string());
    }
    parse_wechat_rows(&rows, file_name, conn)
}

/// 判断订单状态是否为有效完成态（京东: 已完成；淘宝: 交易成功/已签收/交易完成）
fn is_valid_order_status(status: &str) -> bool {
    matches!(status, "" | "已完成" | "交易成功" | "已签收" | "交易完成")
}

/// 校验 CSV 列头是否包含必需列，返回缺失列列表（空表示全部存在）
fn validate_csv_headers(headers: &csv::StringRecord, required: &[&str]) -> Vec<String> {
    required
        .iter()
        .filter(|col| !headers.iter().any(|h| h.trim() == **col))
        .map(|s| s.to_string())
        .collect()
}

/// 从文件名检测平台
fn detect_platform(file_name: &str) -> &str {
    if file_name.starts_with("jd-") || file_name.starts_with("jd_") { return "jd"; }
    if file_name.starts_with("tb-") || file_name.starts_with("tb_") { return "tb"; }
    if file_name.starts_with("steam-") || file_name.starts_with("steam_") { return "steam"; }
    if file_name.starts_with("wx-") || file_name.starts_with("wx_") || file_name.starts_with("微信") { return "wx"; }
    "unknown"
}

/// 从 CSV 内容头回退检测平台（文件名不可靠时使用，如 Android content:// URI）
fn detect_platform_from_content(content: &str) -> &str {
    // 微信账单表头不在首行（前 5 行是元数据），需扫描前 8 行查找表头
    for line in content.lines().take(8) {
        if line.contains("交易单号") && line.contains("金额(元)") && line.contains("交易时间") {
            return "wx";
        }
    }
    let header = content.lines().next().unwrap_or("");
    if header.contains("交易ID") && header.contains("日期") { return "steam"; }
    if header.contains("商品明细JSON") { return "jd"; }
    if header.contains("商品链接") { return "tb"; }
    "unknown"
}

/// 从文件路径解析 CSV/xlsx（桌面端使用）
fn parse_csv_file(path: &PathBuf, conn: &Connection) -> Result<ImportResult, String> {
    let file_name = path
        .file_stem()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    let is_xlsx = path.extension().map(|e| e == "xlsx").unwrap_or(false);
    if is_xlsx {
        let data = fs::read(path).map_err(|e| format!("无法读取文件: {}", e))?;
        return parse_wechat_xlsx_content(&data, &file_name, conn);
    }
    // 非 xlsx 一律按文本处理；微信 CSV 表头不在首行，由 parse_csv_content 内容头回退检测
    let content = fs::read_to_string(path).map_err(|e| format!("无法读取文件: {}", e))?;
    parse_csv_content(&content, &file_name, conn)
}

/// 从字符串内容解析 CSV（Android 端 content:// URI 使用）
fn parse_csv_content(content: &str, file_name: &str, conn: &Connection) -> Result<ImportResult, String> {
    // 文件名优先检测
    let platform = detect_platform(file_name);
    // 文件名检测失败时，通过 CSV 内容头回退检测
    let platform = if platform == "unknown" {
        detect_platform_from_content(content)
    } else {
        platform
    };

    log::info!("[DailyCost] 导入文件 '{}'，平台检测: {}", file_name, platform);

    if platform == "unknown" {
        return Err(format!("无法识别 '{}' 的平台类型，请确保文件名以 jd-/tb-/steam-/wx- 开头", file_name));
    }

    if platform == "steam" {
        return parse_steam_csv_content(content, file_name, conn);
    }

    if platform == "wx" {
        return parse_wechat_csv_content(content, file_name, conn);
    }

    let mut reader = csv::Reader::from_reader(content.as_bytes());

    // ── 校验必需列头（避免列名变化时静默全跳过）──
    let headers = reader.headers().cloned().map_err(|e| format!("读取 CSV 列头失败: {}", e))?;
    let missing = validate_csv_headers(&headers, &["订单编号", "商品名称"]);
    if !missing.is_empty() {
        return Err(format!("CSV 缺少必需列: {}（请使用浏览器扩展导出的标准文件）", missing.join("、")));
    }

    // ── 批量预加载已有记录的去重键（一次 SQL 替代逐行 COUNT(*) 查询）──
    let mut multi_dedup: HashSet<String> = HashSet::new();       // key: order_id
    let mut single_dedup: HashSet<(String, String, String)> = HashSet::new(); // key: (order_id, product_name, model_style)
    {
        let mut stmt = conn
            .prepare("SELECT order_id, product_name, model_style FROM orders WHERE platform=?1")
            .map_err(|e| format!("预加载去重键失败: {}", e))?;
        let rows = stmt
            .query_map(params![platform], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                ))
            })
            .map_err(|e| e.to_string())?;
        for row in rows {
            if let Ok((oid, pn, ms)) = row {
                multi_dedup.insert(oid.clone());
                single_dedup.insert((oid, pn, ms));
            }
        }
    }

    // ── 事务包裹：整文件原子导入，失败自动回滚，避免逐行提交拖慢性能 ──
    let tx = conn.unchecked_transaction().map_err(|e| format!("开启事务失败: {}", e))?;

    let mut imported: usize = 0;
    let mut skipped: usize = 0;

    for result in reader.deserialize() {
        let record: CsvRecord = match result {
            Ok(r) => r,
            Err(_) => {
                skipped += 1;
                continue;
            }
        };

        let order_id = record.order_id.unwrap_or_default().trim().to_string();
        if order_id.is_empty() {
            skipped += 1;
            continue;
        }

        // 只保留有效完成态的订单（京东: 已完成；淘宝: 交易成功/已签收/交易完成）
        let status = record.order_status.unwrap_or_default().trim().to_string();
        if !is_valid_order_status(&status) {
            skipped += 1;
            continue;
        }

        let parent_order_id = record.parent_order_id.unwrap_or_default().trim().to_string();
        let store_name = record.store_name.unwrap_or_default().trim().to_string();
        let import_batch = format!("{} · {}", if platform == "jd" { "京东" } else { "淘宝" }, record.import_batch.unwrap_or_default().trim());
        let order_time = normalize_date(
            &record.pay_time.as_ref().or(record.order_time.as_ref()).unwrap_or(&String::new()).trim(),
        );

        // 拆分 \n 连接的多商品字段（JD/TB 导出器对多商品订单使用 \n 拼接）
        let raw_paid = record.paid_amount.clone().unwrap_or_default();
        let raw_price = record.total_price
            .unwrap_or_else(|| raw_paid.clone());
        let raw_name = record.product_name.unwrap_or_default();
        let raw_pid = record.product_id.unwrap_or_default();
        let raw_style = record.model_style.unwrap_or_default();
        let raw_qty = record.quantity.unwrap_or_default();
        let raw_link = record.product_link.unwrap_or_default();
        let raw_detail = record.product_detail_json.clone().unwrap_or_default();

        let names = split_lines(&raw_name);
        let styles = split_lines(&raw_style);
        let pids = split_lines(&raw_pid);
        let qty_strs = split_lines(&raw_qty);
        let price_strs = split_lines(&raw_price);
        let urls = split_lines(&raw_link);
        let n = names.len().max(1);

        // 多商品订单 → 合并为一行，子商品信息存入 model_style
        if n > 1 {
            let pn = names[0].to_string();
            let items: Vec<String> = names.iter().zip(pids.iter()).enumerate()
                .map(|(_i, (nm, id))| format!("{}{}{}", nm, if id.is_empty() {""} else {" #"}, id))
                .collect();
            let summary = format!("共{}件\n{}", n, items.join("\n"));
            let raw_qty_sum: i32 = qty_strs.iter().filter_map(|s| s.parse::<i32>().ok()).sum();
            let total_qty: i32 = if raw_qty_sum > 0 { raw_qty_sum } else { n as i32 };
            let price: f64 = raw_paid.trim().parse().unwrap_or(0.0);
            let pid = pids[0].to_string();
            let url = if platform == "tb" { urls[0].to_string() } else { extract_jd_product_url(&raw_detail, &pn) };
            let (category, emoji) = match_product_category(&pn, &store_name, &platform);

            let exists = multi_dedup.contains(&order_id);

            if !exists {
                tx.execute(
                    "INSERT INTO orders (order_id, parent_order_id, product_id, platform, store_name, product_name, model_style, quantity, total_price, order_time, import_batch, product_url, emoji, end_date, end_reason, sell_price, category)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, '', '', 0, ?14)",
                    params![order_id, parent_order_id, pid, platform, store_name, pn, summary, total_qty, price, order_time, import_batch, url, emoji, category],
                ).map_err(|e| format!("数据库插入失败: {}", e))?;
                // 同步更新去重缓存
                multi_dedup.insert(order_id.clone());
                single_dedup.insert((order_id.clone(), pn.clone(), summary.clone()));
                imported += 1;
            } else {
                skipped += 1;
            }
            continue;
        }

        // 单商品
        for i in 0..n {
            let pn = names.get(i).map(|s| s.to_string()).unwrap_or_default();
            if pn.is_empty() || pn == "商品名称" { skipped += 1; continue; }

            let ms = styles.get(i).map(|s| s.to_string()).unwrap_or_default();
            let qty: i32 = qty_strs.get(i).unwrap_or(&"1").parse().unwrap_or(1);
            // 单商品：优先取实付金额（订单真实支付总额），避免数量>1 时商品总价仅为单价导致金额低估
            let price: f64 = raw_paid.trim().parse().ok()
                .filter(|v| *v > 0.0)
                .unwrap_or_else(|| price_strs.get(i).unwrap_or(price_strs.first().unwrap_or(&"0")).parse().unwrap_or(0.0));

            let pid = pids.get(i).map(|s| s.to_string()).unwrap_or_default();

            let url = if platform == "tb" {
                urls.get(i).map(|s| s.to_string()).unwrap_or_default()
            } else {
                extract_jd_product_url(&raw_detail, &pn)
            };

            let (category, emoji) = match_product_category(&pn, &store_name, &platform);

            // 去重：同平台+同订单+同商品名+同型号才视为重复（内存 HashSet 比对）
            let dedup_key = (order_id.clone(), pn.clone(), ms.clone());
            let exists = single_dedup.contains(&dedup_key);

            if exists { skipped += 1; continue; }

            tx.execute(
                "INSERT INTO orders (order_id, parent_order_id, product_id, platform, store_name, product_name, model_style, quantity, total_price, order_time, import_batch, product_url, emoji, end_date, end_reason, sell_price, category)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, '', '', 0, ?14)",
                params![order_id, parent_order_id, pid, platform, store_name, pn, ms, qty, price, order_time, import_batch, url, emoji, category],
            ).map_err(|e| format!("数据库插入失败: {}", e))?;

            // 同步更新去重缓存
            multi_dedup.insert(order_id.clone());
            single_dedup.insert(dedup_key);
            imported += 1;
        }
    }

    tx.commit().map_err(|e| format!("提交事务失败: {}", e))?;

    Ok(ImportResult {
        success: true,
        imported,
        skipped,
        message: format!(
            "成功导入 {} 条，跳过 {} 条（重复或无效）\n平台: {} | 文件名: {}",
            imported, skipped,
            if platform == "jd" { "京东" } else { "淘宝" },
            file_name
        ),
    })
}

// ── 日期归一化 ────────────────────────────────────────────

/// 日期归一化：保留时间精度（YYYY-MM-DD 或 YYYY-MM-DD HH:MM:SS）
fn normalize_date(raw: &str) -> String {
    let raw = raw.trim();
    if raw.is_empty() { return String::new(); }

    // 提取时间部分（HH:MM:SS 或 HH:MM）
    let time_part = raw.split_whitespace().nth(1).filter(|t| t.contains(':')).unwrap_or("");

    // 取日期部分并解析
    let date_str = raw.split_whitespace().next().unwrap_or(raw);
    let cleaned = date_str
        .replace(" 年 ", "-").replace(" 月 ", "-").replace(" 日", "")
        .replace("年", "-").replace("月", "-").replace("日", "");
    let parts: Vec<&str> = cleaned.split('-').collect();
    if parts.len() == 3 && parts[0].len() == 4 {
        let y = parts[0];
        let m = format!("{:0>2}", parts[1]);
        let d = format!("{:0>2}", parts[2]);
        if time_part.is_empty() {
            return format!("{}-{}-{}", y, m, d);
        }
        return format!("{}-{}-{} {}", y, m, d, time_part);
    }
    raw.to_string()
}

/// 解析日期（仅取日期部分，兼容含时间的格式）
/// 返回 None 表示日期无效，调用方应跳过或返回 0
fn parse_date(s: &str) -> Option<chrono::NaiveDate> {
    if s.is_empty() {
        return None;
    }
    let date_only = &s[..s.len().min(10)];
    chrono::NaiveDate::parse_from_str(date_only, "%Y-%m-%d").ok()
}

// ── 日均成本计算 ──────────────────────────────────────────

fn calc_daily_avg(price: f64, order_time: &str, end_date: &str, sell_price: f64) -> f64 {
    if price <= 0.0 { return 0.0; }
    let net_cost = if !end_date.is_empty() && sell_price > 0.0 { price - sell_price } else { price };

    let purchase = match parse_date(order_time) {
        Some(d) => d,
        None => {
            log::warn!("[DailyCost] 无法解析购买日期 '{}'，日均成本返回 0", order_time);
            return 0.0;
        }
    };

    let end = if !end_date.is_empty() {
        match parse_date(end_date) {
            Some(d) => d,
            None => {
                log::warn!("[DailyCost] 无法解析截止日期 '{}'，日均成本返回 0", end_date);
                return 0.0;
            }
        }
    } else {
        Utc::now().date_naive()
    };

    let days = (end - purchase).num_days().max(1) as f64;
    (net_cost / days * 100.0).round() / 100.0
}

// ── Tauri Commands ────────────────────────────────────────

#[tauri::command]
fn import_csv(path: String, state: State<DbState>) -> Result<ImportResult, String> {
    let file_path = PathBuf::from(&path);
    if !file_path.exists() {
        return Err(format!("文件不存在: {}", path));
    }
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    parse_csv_file(&file_path, &conn)
}

#[tauri::command]
fn import_multiple_csv(paths: Vec<String>, state: State<DbState>) -> Result<ImportResult, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    batch_import_csv(&paths, &conn)
}

/// 从文本内容导入 CSV（Android content:// URI 场景）
#[tauri::command]
fn import_csv_content(contents: Vec<String>, file_names: Vec<String>, state: State<DbState>) -> Result<ImportResult, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let mut total_imported = 0usize;
    let mut total_skipped = 0usize;
    let mut messages: Vec<String> = Vec::new();

    for (i, content) in contents.iter().enumerate() {
        let file_name = file_names.get(i).map(|s| s.as_str()).unwrap_or("unknown");
        match parse_csv_content(content, file_name, &conn) {
            Ok(r) => {
                total_imported += r.imported;
                total_skipped += r.skipped;
                messages.push(r.message);
            }
            Err(e) => messages.push(format!("{}: {}", file_name, e)),
        }
    }

    if total_imported == 0 && total_skipped == 0 {
        return Err(messages.join("\n"));
    }

    Ok(ImportResult {
        success: true,
        imported: total_imported,
        skipped: total_skipped,
        message: format!("成功导入 {} 条，跳过 {} 条\n{}", total_imported, total_skipped, messages.join("\n")),
    })
}

/// 从 xlsx 字节内容导入（Android content:// URI 场景：xlsx 为二进制，readTextFile 读不了）
/// 微信账单为单文件导出，此处按单文件处理（data 为一个 xlsx 的字节，file_names 取首个作批次名）
#[tauri::command]
fn import_xlsx_content(data: Vec<u8>, file_names: Vec<String>, state: State<DbState>) -> Result<ImportResult, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let file_name = file_names.get(0).map(|s| s.as_str()).unwrap_or("微信账单");
    match parse_wechat_xlsx_content(&data, file_name.trim_end_matches(".xlsx"), &conn) {
        Ok(r) => Ok(r),
        Err(e) => Err(format!("{}: {}", file_name, e)),
    }
}

/// 批量导入 CSV/Excel 的共享逻辑（命令和拖拽共用）
fn batch_import_csv(paths: &[String], conn: &Connection) -> Result<ImportResult, String> {
    let mut total_imported = 0usize;
    let mut total_skipped = 0usize;
    let mut messages: Vec<String> = Vec::new();

    for path in paths {
        let file_path = PathBuf::from(path);
        if !file_path.exists() {
            messages.push(format!("{}: 文件不存在", path));
            continue;
        }
        let ext = file_path.extension().map(|e| e.to_string_lossy().to_lowercase()).unwrap_or_default();
        if ext != "csv" && ext != "xlsx" {
            messages.push(format!("{}: 不是 CSV/Excel 文件", path));
            continue;
        }
        match parse_csv_file(&file_path, conn) {
            Ok(r) => {
                total_imported += r.imported;
                total_skipped += r.skipped;
                messages.push(r.message);
            }
            Err(e) => messages.push(format!("{}: {}", path, e)),
        }
    }

    if total_imported == 0 && total_skipped == 0 {
        return Err(messages.join("\n"));
    }

    Ok(ImportResult {
        success: true,
        imported: total_imported,
        skipped: total_skipped,
        message: format!("成功导入 {} 条，跳过 {} 条\n{}", total_imported, total_skipped, messages.join("\n")),
    })
}

#[tauri::command]
fn get_items(state: State<DbState>) -> Result<Vec<OrderItem>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT id, order_id, parent_order_id, product_id, platform, store_name,
                    product_name, model_style, quantity, total_price, order_time, import_batch, product_url, emoji,
                    end_date, end_reason, sell_price, archived, category
             FROM orders
             WHERE archived = 0
             ORDER BY order_time DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows: Vec<OrderItem> = map_order_rows(&mut stmt)?;

    // 填充 daily_avg_cost 和 emoji
    // 每个物品独立计算日均成本（基于自身价格和日期，不再按父订单汇总分摊）
    let items: Vec<OrderItem> = rows
        .into_iter()
        .map(|mut item| {
            // 售价为0的商品（赠品、保修卡等），日均成本直接为0
            if item.total_price <= 0.0 {
                item.daily_avg_cost = 0.0;
            } else {
                let sell_price = if item.end_reason == "sold" { item.sell_price } else { 0.0 };
                item.daily_avg_cost = calc_daily_avg(item.total_price, &item.order_time, &item.end_date, sell_price);
            }
            // 空值自动回填：一次匹配同时得到 emoji 和分类
            if item.emoji.is_empty() || item.category.is_empty() {
                let (cat, em) = match_product_category(&item.product_name, &item.store_name, &item.platform);
                if item.emoji.is_empty() { item.emoji = em.to_string(); }
                if item.category.is_empty() { item.category = cat.to_string(); }
            }
            item
        })
        .collect();

    Ok(items)
}

/// 从查询结果映射为 OrderItem 列表（get_items / get_archived_items 共用）
fn map_order_rows(stmt: &mut rusqlite::Statement) -> Result<Vec<OrderItem>, String> {
    stmt.query_map([], |row| {
        Ok(OrderItem {
            id: row.get(0)?,
            order_id: row.get(1)?,
            parent_order_id: row.get(2)?,
            product_id: row.get::<_, String>(3).unwrap_or_default(),
            platform: row.get(4)?,
            store_name: row.get(5)?,
            product_name: row.get(6)?,
            model_style: row.get(7)?,
            quantity: row.get(8)?,
            total_price: row.get(9)?,
            order_time: row.get(10)?,
            daily_avg_cost: 0.0,
            emoji: row.get::<_, String>(13).unwrap_or_default(),
            import_batch: row.get(11)?,
            product_url: row.get(12)?,
            end_date: row.get::<_, String>(14).unwrap_or_default(),
            end_reason: row.get::<_, String>(15).unwrap_or_default(),
            sell_price: row.get::<_, f64>(16).unwrap_or(0.0),
            archived: row.get::<_, bool>(17).unwrap_or(false),
            category: row.get::<_, String>(18).unwrap_or_default(),
        })
    })
    .map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn clear_all_data(state: State<DbState>) -> Result<String, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM orders", [])
        .map_err(|e| e.to_string())?;
    // 微信收入/回款记录一并清除
    conn.execute("DELETE FROM income_records", [])
        .map_err(|e| e.to_string())?;
    Ok("所有数据已清除".to_string())
}

#[tauri::command(rename_all = "snake_case")]
fn update_item(
    id: i64,
    product_name: String,
    product_url: String,
    order_time: String,
    total_price: f64,
    quantity: i32,
    emoji: String,
    platform: String,
    store_name: String,
    model_style: String,
    end_date: String,
    end_reason: String,
    sell_price: f64,
    category: String,
    state: State<DbState>,
) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let order_time = normalize_date(&order_time);
    let end_date_clean = if end_date.is_empty() { String::new() } else { normalize_date(&end_date) };
    conn.execute(
        "UPDATE orders SET product_name=?1, product_url=?2, order_time=?3,
         total_price=?4, quantity=?5, emoji=?6, platform=?7, store_name=?8, model_style=?9,
         end_date=?10, end_reason=?11, sell_price=?12, category=?13
         WHERE id=?14",
        params![product_name, product_url, order_time, total_price, quantity, emoji, platform, store_name, model_style, end_date_clean, end_reason, sell_price, category, id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
fn add_item(
    order_id: String,
    platform: String,
    store_name: String,
    product_name: String,
    model_style: String,
    quantity: i32,
    total_price: f64,
    order_time: String,
    emoji: String,
    product_url: String,
    end_date: String,
    end_reason: String,
    sell_price: f64,
    category: String,
    state: State<DbState>,
) -> Result<i64, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let import_batch = "自定义";
    let order_time = normalize_date(&order_time);
    conn.execute(
        "INSERT INTO orders (order_id, parent_order_id, product_id, platform, store_name, product_name, model_style, quantity, total_price, order_time, import_batch, product_url, emoji, end_date, end_reason, sell_price, category)
         VALUES (?1, '', '', ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
        params![order_id, platform, store_name, product_name, model_style, quantity, total_price, order_time, import_batch, product_url, emoji, end_date, end_reason, sell_price, category],
    ).map_err(|e| e.to_string())?;
    Ok(conn.last_insert_rowid())
}

#[tauri::command]
fn delete_item(id: i64, state: State<DbState>) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM orders WHERE id=?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn archive_item(id: i64, state: State<DbState>) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    conn.execute("UPDATE orders SET archived = 1 WHERE id=?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// 智能分类：根据 mode 参数仅覆盖 category 或 emoji（"category" | "emoji"）
#[tauri::command]
fn recalculate_categories(state: State<DbState>, mode: String) -> Result<(usize, usize), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;

    let column = if mode == "emoji" { "emoji" } else { "category" };
    let sql = format!("UPDATE orders SET {} = ?1 WHERE id = ?2", column);

    // 查询所有记录
    let mut stmt = conn
        .prepare("SELECT id, product_name, store_name, platform FROM orders")
        .map_err(|e| e.to_string())?;

    struct Row { id: i64, product_name: String, store_name: String, platform: String }
    let rows: Vec<Row> = stmt
        .query_map([], |row| {
            Ok(Row {
                id: row.get(0)?,
                product_name: row.get(1)?,
                store_name: row.get(2)?,
                platform: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let total = rows.len();
    let mut updated = 0;

    let mut update_stmt = conn
        .prepare(&sql)
        .map_err(|e| e.to_string())?;

    for row in &rows {
        let (cat, em) = match_product_category(&row.product_name, &row.store_name, &row.platform);
        let val = if mode == "emoji" { em } else { cat };
        update_stmt
            .execute(params![val, row.id])
            .map_err(|e| e.to_string())?;
        updated += 1;
    }

    Ok((total, updated))
}

#[tauri::command]
fn restore_item(id: i64, state: State<DbState>) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    conn.execute("UPDATE orders SET archived = 0 WHERE id=?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_archived_items(state: State<DbState>) -> Result<Vec<OrderItem>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT id, order_id, parent_order_id, product_id, platform, store_name,
                    product_name, model_style, quantity, total_price, order_time, import_batch, product_url, emoji,
                    end_date, end_reason, sell_price, archived, category
             FROM orders
             WHERE archived = 1
             ORDER BY order_time DESC",
        )
        .map_err(|e| e.to_string())?;

    map_order_rows(&mut stmt)
}

#[tauri::command]
fn get_archived_count(state: State<DbState>) -> Result<i64, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    conn.query_row("SELECT COUNT(*) FROM orders WHERE archived = 1", [], |row| row.get(0))
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn batch_restore_items(ids: Vec<i64>, state: State<DbState>) -> Result<usize, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    batch_execute(&conn, "UPDATE orders SET archived = 0", &ids)
}

#[tauri::command]
fn batch_delete_items(ids: Vec<i64>, state: State<DbState>) -> Result<usize, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    batch_execute(&conn, "DELETE FROM orders", &ids)
}

#[tauri::command]
fn batch_archive_items(ids: Vec<i64>, state: State<DbState>) -> Result<usize, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    batch_execute(&conn, "UPDATE orders SET archived = 1", &ids)
}

/// 批量 SQL 执行（构建 IN (?) 占位符）
fn batch_execute(conn: &Connection, sql: &str, ids: &[i64]) -> Result<usize, String> {
    let holders: Vec<String> = (1..=ids.len()).map(|i| format!("?{}", i)).collect();
    let full_sql = format!("{sql} WHERE id IN ({})", holders.join(","));
    let params: Vec<&dyn rusqlite::types::ToSql> = ids.iter().map(|id| id as &dyn rusqlite::types::ToSql).collect();
    conn.execute(&full_sql, rusqlite::params_from_iter(params))
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn export_database(path: String, state: State<DbState>) -> Result<String, String> {
    let source = state.db.lock().map_err(|e| e.to_string())?;
    let mut destination = Connection::open(&path)
        .map_err(|e| format!("无法创建备份文件: {}", e))?;
    let backup = Backup::new(&source, &mut destination)
        .map_err(|e| format!("创建备份失败: {}", e))?;
    backup.step(-1).map_err(|e| format!("导出失败: {}", e))?;
    Ok(format!("数据库已导出到: {}", path))
}

// ── Android 导出：ContentResolver 原生复制 ─────────────────
// 修复 tauri-plugin-fs 写 content:// URI 产生 0 字节文件的已知 bug
// （plugins-workspace#3356：fs 插件 detachFd 使 provider 在写入前就关闭句柄）
// 方案：Kotlin 侧用 ContentResolver.openOutputStream 保持流存活完成整段复制
#[cfg(target_os = "android")]
struct BackupAndroid(tauri::plugin::PluginHandle<tauri::Wry>);

#[cfg(target_os = "android")]
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct CopyToUriArgs {
    source_path: String,
    dest_uri: String,
}

/// Android 端导出：save() 返回 content:// URI，Rust 无法直接写入
/// 由 Kotlin 插件（BackupPlugin.copyFileToUri）用 ContentResolver.openOutputStream
/// 把 Rust 侧生成的备份快照复制到所选位置（规避 fs 插件 detachFd 导致的 0 字节 bug）
#[tauri::command(rename_all = "snake_case")]
fn export_database_to_uri(
    dest_uri: String,
    state: State<DbState>,
    app: tauri::AppHandle,
) -> Result<String, String> {
    let source = state.db.lock().map_err(|e| e.to_string())?;
    let tmp_path = state.db_path.with_extension("export.tmp");
    let _ = fs::remove_file(&tmp_path);
    {
        let mut dest =
            Connection::open(&tmp_path).map_err(|e| format!("无法创建备份文件: {}", e))?;
        let backup = Backup::new(&source, &mut dest).map_err(|e| format!("创建备份失败: {}", e))?;
        backup.step(-1).map_err(|e| format!("导出失败: {}", e))?;
    }
    drop(source);

    #[cfg(target_os = "android")]
    {
        let handle = &app.state::<BackupAndroid>().0;
        handle
            .run_mobile_plugin::<serde_json::Value>(
                "copyFileToUri",
                CopyToUriArgs {
                    source_path: tmp_path.to_string_lossy().to_string(),
                    dest_uri,
                },
            )
            .map_err(|e| format!("复制到所选位置失败: {}", e))?;
        let _ = fs::remove_file(&tmp_path);
        Ok("数据库已导出".to_string())
    }

    #[cfg(not(target_os = "android"))]
    {
        let _ = fs::remove_file(&tmp_path);
        let _ = (dest_uri, app);
        Err("该命令仅支持 Android".to_string())
    }
}

#[tauri::command(rename_all = "snake_case")]
fn import_database(path: String, state: State<DbState>) -> Result<String, String> {
    let src = PathBuf::from(&path);
    if !src.exists() {
        return Err("文件不存在".to_string());
    }

    let temp_path = state.db_path.with_extension("import.tmp");
    let _ = fs::remove_file(&temp_path);
    fs::copy(&src, &temp_path).map_err(|e| format!("无法准备导入文件: {}", e))?;

    let restore_result = restore_database_from_temp(&temp_path, &state);
    let _ = fs::remove_file(&temp_path);
    restore_result?;

    Ok("数据库导入成功，数据已恢复".to_string())
}

/// Android 端导入：open() 返回 content:// URI，Rust 无法直接读取
/// 前端用 fs 插件 readFile 读字节 → 本命令写入临时文件后走同一恢复逻辑
#[tauri::command(rename_all = "snake_case")]
fn import_database_bytes(data: Vec<u8>, state: State<DbState>) -> Result<String, String> {
    let temp_path = state.db_path.with_extension("import.tmp");
    let _ = fs::remove_file(&temp_path);
    fs::write(&temp_path, &data).map_err(|e| format!("无法准备导入文件: {}", e))?;

    let restore_result = restore_database_from_temp(&temp_path, &state);
    let _ = fs::remove_file(&temp_path);
    restore_result?;

    Ok("数据库导入成功，数据已恢复".to_string())
}

/// 校验并恢复导入的数据库（从临时文件导入到主库），import_database / import_database_bytes 共用
fn restore_database_from_temp(temp_path: &std::path::Path, state: &DbState) -> Result<(), String> {
    let imported = Connection::open(temp_path).map_err(|e| format!("无法打开文件: {}", e))?;
    let integrity: String = imported
        .query_row("PRAGMA integrity_check", [], |row| row.get(0))
        .map_err(|e| format!("数据库完整性检查失败: {}", e))?;
    if integrity != "ok" {
        return Err(format!("所选数据库已损坏: {}", integrity));
    }
    let has_orders: bool = imported
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='orders'",
            [],
            |row| row.get::<_, i64>(0),
        )
        .map_err(|e| format!("无法验证数据库结构: {}", e))?
        > 0;
    if !has_orders {
        return Err("所选文件不是有效的物品记账数据库".to_string());
    }
    init_db(&imported).map_err(|e| format!("数据库迁移失败: {}", e))?;

    let mut active = state.db.lock().map_err(|e| e.to_string())?;
    {
        let backup = Backup::new(&imported, &mut active)
            .map_err(|e| format!("创建恢复任务失败: {}", e))?;
        backup.step(-1).map_err(|e| format!("导入失败: {}", e))?;
    }
    active
        .execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")
        .map_err(|e| format!("设置数据库参数失败: {}", e))?;
    Ok(())
}

/// 导入内置示例数据（首次使用引导）
/// 从编译时嵌入的 example-data.db 读取示例物品，在内存中去重后写入主数据库
#[tauri::command]
fn import_example_data(state: State<DbState>) -> Result<String, String> {
    // 编译时嵌入示例数据库
    let example_bytes: &[u8] = include_bytes!("../example-data.db");

    // 写入临时文件（rusqlite 不支持直接从字节数组打开）
    let app_data_dir = state.db_path.parent()
        .map(|p| p.to_path_buf())
        .unwrap_or_else(|| PathBuf::from("."));
    let tmp_path = app_data_dir.join("_example_import_temp.db");

    fs::write(&tmp_path, example_bytes)
        .map_err(|e| format!("写入临时文件失败: {}", e))?;

    // 打开示例数据库并读取所有行
    let result = (|| -> Result<String, String> {
        let example_conn = Connection::open(&tmp_path)
            .map_err(|e| format!("打开示例数据库失败: {}", e))?;

        struct ExampleRow {
            order_id: String,
            parent_order_id: String,
            product_id: String,
            platform: String,
            store_name: String,
            product_name: String,
            model_style: String,
            quantity: i32,
            total_price: f64,
            order_time: String,
            import_batch: String,
            product_url: String,
            emoji: String,
            end_date: String,
            end_reason: String,
            sell_price: f64,
        }

        /// 示例微信回款行（收入流水，独立于物品表）
        struct ExampleIncome {
            order_id: String,
            platform: String,
            peer: String,
            income_type: String,
            amount: f64,
            order_time: String,
            status: String,
            import_batch: String,
        }

        // 读取示例物品与回款数据（在独立作用域内完成以避免借用冲突）
        let rows: Vec<ExampleRow> = {
            let mut stmt = example_conn.prepare(
                "SELECT order_id, parent_order_id, product_id, platform, store_name, product_name,
                        model_style, quantity, total_price, order_time, import_batch,
                        product_url, emoji, end_date, end_reason, sell_price
                 FROM orders"
            ).map_err(|e| e.to_string())?;

            let mapped = stmt.query_map([], |row| {
                Ok(ExampleRow {
                    order_id: row.get(0)?,
                    parent_order_id: row.get(1)?,
                    product_id: row.get::<_, String>(2).unwrap_or_default(),
                    platform: row.get(3)?,
                    store_name: row.get(4)?,
                    product_name: row.get(5)?,
                    model_style: row.get(6)?,
                    quantity: row.get(7)?,
                    total_price: row.get(8)?,
                    order_time: row.get(9)?,
                    import_batch: row.get(10)?,
                    product_url: row.get(11)?,
                    emoji: row.get(12)?,
                    end_date: row.get(13)?,
                    end_reason: row.get(14)?,
                    sell_price: row.get(15)?,
                })
            }).map_err(|e| e.to_string())?;

            mapped
                .collect::<Result<Vec<_>, _>>()
                .map_err(|e| e.to_string())?
        };

        let example_incomes: Vec<ExampleIncome> = {
            let mut stmt = example_conn.prepare(
                "SELECT order_id, platform, peer, income_type, amount, order_time, status, import_batch
                 FROM income_records"
            ).map_err(|e| e.to_string())?;

            let mapped = stmt.query_map([], |row| {
                Ok(ExampleIncome {
                    order_id: row.get(0)?,
                    platform: row.get(1)?,
                    peer: row.get::<_, String>(2).unwrap_or_default(),
                    income_type: row.get::<_, String>(3).unwrap_or_default(),
                    amount: row.get(4)?,
                    order_time: row.get::<_, String>(5).unwrap_or_default(),
                    status: row.get::<_, String>(6).unwrap_or_default(),
                    import_batch: row.get::<_, String>(7).unwrap_or_default(),
                })
            }).map_err(|e| e.to_string())?;

            mapped
                .collect::<Result<Vec<_>, _>>()
                .map_err(|e| e.to_string())?
        };

        drop(example_conn);

        if rows.is_empty() {
            return Err("示例数据为空".to_string());
        }

        // 获取主数据库中已有的 (platform, order_id) 去重键
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        let mut dedup_stmt = conn.prepare(
            "SELECT platform, order_id FROM orders"
        ).map_err(|e| e.to_string())?;

        let existing: HashSet<(String, String)> = dedup_stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        }).map_err(|e| e.to_string())?
          .filter_map(|r| r.ok())
          .collect();

        let mut imported = 0usize;
        let mut skipped = 0usize;

        for row in &rows {
            let key = (row.platform.clone(), row.order_id.clone());
            if existing.contains(&key) {
                skipped += 1;
                continue;
            }

            // 日期归一化
            let order_time = normalize_date(&row.order_time);
            let end_date = if row.end_date.is_empty() {
                String::new()
            } else {
                normalize_date(&row.end_date)
            };

            // 自动匹配分类和 emoji（若示例中未预设则自动补全）
            let (category, emoji) = if row.emoji.is_empty() {
                match_product_category(&row.product_name, &row.store_name, &row.platform)
            } else {
                // 已有 emoji，但仍需确保 category 有值
                let cat = match_product_category(&row.product_name, &row.store_name, &row.platform).0;
                (cat, row.emoji.as_str())
            };

            conn.execute(
                "INSERT INTO orders (order_id, parent_order_id, product_id, platform, store_name,
                 product_name, model_style, quantity, total_price, order_time, import_batch,
                 product_url, emoji, end_date, end_reason, sell_price, category)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)",
                params![
                    row.order_id, row.parent_order_id, row.product_id, row.platform, row.store_name,
                    row.product_name, row.model_style, row.quantity, row.total_price,
                    order_time, row.import_batch, row.product_url, emoji.to_string(),
                    end_date, row.end_reason, row.sell_price, category,
                ],
            ).map_err(|e| format!("插入失败: {}", e))?;

            imported += 1;
        }

        // ── 微信回款（income_records）：独立去重（order_id），与支出单号互不冲突 ──
        let mut income_dedup: HashSet<String> = HashSet::new();
        {
            let mut stmt = conn.prepare("SELECT order_id FROM income_records")
                .map_err(|e| e.to_string())?;
            let r = stmt.query_map([], |row| row.get::<_, String>(0))
                .map_err(|e| e.to_string())?;
            for row in r { if let Ok(oid) = row { income_dedup.insert(oid); } }
        }

        let mut income_imported = 0usize;
        for income in &example_incomes {
            if income_dedup.contains(&income.order_id) {
                skipped += 1;
                continue;
            }
            conn.execute(
                "INSERT INTO income_records (order_id, platform, peer, income_type, amount, order_time, status, import_batch)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![
                    income.order_id, income.platform, income.peer, income.income_type,
                    income.amount, normalize_date(&income.order_time), income.status, income.import_batch,
                ],
            ).map_err(|e| format!("回款插入失败: {}", e))?;
            income_dedup.insert(income.order_id.clone());
            income_imported += 1;
        }

        Ok(format!(
            "成功导入 {} 条物品、{} 条微信回款，跳过 {} 条已存在",
            imported, income_imported, skipped
        ))
    })();

    // 清理临时文件
    let _ = fs::remove_file(&tmp_path);

    result
}

#[tauri::command]
fn save_setting(key: String, value: String, state: State<DbState>) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = ?2",
        params![key, value],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_setting(key: String, state: State<DbState>) -> Result<String, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    conn.query_row(
        "SELECT value FROM settings WHERE key = ?1",
        params![key],
        |row| row.get(0),
    ).or_else(|_| Ok(String::new()))
}

#[tauri::command]
fn get_all_settings(state: State<DbState>) -> Result<HashMap<String, String>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT key, value FROM settings").map_err(|e| e.to_string())?;
    let map: HashMap<String, String> = stmt
        .query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(map)
}

#[tauri::command]
fn get_database_path(state: State<DbState>) -> String {
    state.db_path.to_string_lossy().to_string()
}

#[tauri::command]
fn get_import_batches(state: State<DbState>) -> Result<Vec<String>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT DISTINCT import_batch FROM orders WHERE import_batch != '' ORDER BY import_batch")
        .map_err(|e| e.to_string())?;
    let batches = stmt
        .query_map([], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<String>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(batches)
}

/// Tauri Updater 仅支持桌面系统；移动端必须回退到手动下载。
#[tauri::command]
fn updater_is_supported() -> bool {
    cfg!(any(target_os = "windows", target_os = "macos", target_os = "linux"))
}

// ── 数据分析命令 ──────────────────────────────────────────

/// 月度消费统计：按 YYYY-MM 分组汇总消费金额和物品数量
/// 构建时间范围 SQL 条件（YYYY-MM 前缀匹配，可选），返回 (条件片段, 参数)
/// 用于分析页全局时间范围过滤：start/end 为空串或 None 表示不限制
fn month_range_cond(start: &Option<String>, end: &Option<String>, col: &str) -> (String, Vec<String>) {
    let mut cond = String::new();
    let mut params: Vec<String> = Vec::new();
    if let Some(s) = start {
        if !s.is_empty() {
            cond.push_str(&format!(" AND substr({}, 1, 7) >= ?", col));
            params.push(s.clone());
        }
    }
    if let Some(e) = end {
        if !e.is_empty() {
            cond.push_str(&format!(" AND substr({}, 1, 7) <= ?", col));
            params.push(e.clone());
        }
    }
    (cond, params)
}

/// 微信收支分析：总览（支出/回款/净支出）、回款结构（按交易类型）、回款来源 Top、月度收支
/// start/end 为可选时间范围（"YYYY-MM"），仅统计该区间内的微信支出与回款
#[tauri::command]
fn get_wechat_analytics(
    state: State<DbState>,
    start: Option<String>,
    end: Option<String>,
) -> Result<WechatAnalytics, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;

    // 时间范围条件（orders 与 income_records 均按 order_time 前缀匹配）
    let (time_cond, time_params) = month_range_cond(&start, &end, "order_time");

    // ── 总览：微信支出（orders）+ 微信回款（income_records）──
    let expense_total: f64 = conn
        .query_row(
            &format!(
                "SELECT COALESCE(SUM(total_price), 0) FROM orders
                 WHERE platform='wx' AND archived=0{}",
                time_cond
            ),
            rusqlite::params_from_iter(time_params.iter()),
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    let income_total: f64 = conn
        .query_row(
            &format!(
                "SELECT COALESCE(SUM(amount), 0) FROM income_records WHERE 1=1{}",
                time_cond
            ),
            rusqlite::params_from_iter(time_params.iter()),
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    let overview = WechatOverview {
        expense_total,
        income_total,
        net_total: expense_total - income_total,
    };

    // ── 回款结构：按交易类型分组（含"退款"的类型统一归为"退款"，避免商户名碎片化）──
    let mut stmt = conn
        .prepare(
            &format!(
                "SELECT CASE WHEN income_type LIKE '%退款%' THEN '退款'
                        WHEN income_type = '' THEN '未知'
                        ELSE income_type END AS t,
                        SUM(amount) AS total, COUNT(*) AS cnt
                 FROM income_records WHERE 1=1{} GROUP BY t ORDER BY total DESC",
                time_cond
            ),
        )
        .map_err(|e| e.to_string())?;
    let by_type: Vec<IncomeByType> = stmt
        .query_map(rusqlite::params_from_iter(time_params.iter()), |row| {
            Ok(IncomeByType {
                income_type: row.get(0)?,
                total: row.get(1)?,
                count: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    // ── 回款来源 Top 10：按交易对方分组 ──
    let mut stmt = conn
        .prepare(
            &format!(
                "SELECT COALESCE(NULLIF(peer, ''), '未知') AS p, SUM(amount) AS total, COUNT(*) AS cnt
                 FROM income_records WHERE 1=1{} GROUP BY p ORDER BY total DESC LIMIT 10",
                time_cond
            ),
        )
        .map_err(|e| e.to_string())?;
    let peers: Vec<IncomePeer> = stmt
        .query_map(rusqlite::params_from_iter(time_params.iter()), |row| {
            Ok(IncomePeer {
                peer: row.get(0)?,
                total: row.get(1)?,
                count: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    // ── 月度收支：合并微信支出与回款，按月对齐 ──
    let mut monthly_map: HashMap<String, (f64, f64)> = HashMap::new();
    {
        let mut stmt = conn
            .prepare(
                &format!(
                    "SELECT substr(order_time, 1, 7) AS m, SUM(total_price) AS total
                     FROM orders WHERE platform='wx' AND archived=0 AND order_time <> ''{}
                     GROUP BY m",
                    time_cond
                ),
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(rusqlite::params_from_iter(time_params.iter()), |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, f64>(1)?))
            })
            .map_err(|e| e.to_string())?;
        for r in rows {
            if let Ok((m, v)) = r {
                monthly_map.entry(m).or_insert((0.0, 0.0)).0 = v;
            }
        }
    }
    {
        let mut stmt = conn
            .prepare(
                &format!(
                    "SELECT substr(order_time, 1, 7) AS m, SUM(amount) AS total
                     FROM income_records WHERE order_time <> ''{} GROUP BY m",
                    time_cond
                ),
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(rusqlite::params_from_iter(time_params.iter()), |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, f64>(1)?))
            })
            .map_err(|e| e.to_string())?;
        for r in rows {
            if let Ok((m, v)) = r {
                monthly_map.entry(m).or_insert((0.0, 0.0)).1 = v;
            }
        }
    }
    let mut monthly: Vec<WechatMonthly> = monthly_map
        .into_iter()
        .map(|(month, (expense, income))| WechatMonthly { month, expense, income, net: expense - income })
        .collect();
    monthly.sort_by(|a, b| a.month.cmp(&b.month));

    Ok(WechatAnalytics { overview, by_type, peers, monthly })
}

/// 微信收入/回款记录（单条流水，供回款来源下钻查看）
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct IncomeRecord {
    pub id: i64,
    pub order_id: String,
    pub peer: String,
    pub income_type: String,
    pub amount: f64,
    pub order_time: String,
    pub status: String,
    pub import_batch: String,
}

/// 查询某个回款来源（交易对方）的全部收入流水，按时间倒序（回款来源 Top 榜点击下钻）
#[tauri::command]
fn get_income_records_by_peer(peer: String, state: State<DbState>) -> Result<Vec<IncomeRecord>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    // 展示层将空 peer 回退为「未知」，此处还原为空值以精确匹配
    let is_unknown = peer == "未知";
    let mut stmt = if is_unknown {
        conn.prepare(
            "SELECT id, order_id, peer, income_type, amount, order_time, status, import_batch
             FROM income_records WHERE (peer = '' OR peer IS NULL) ORDER BY order_time DESC",
        )
        .map_err(|e| e.to_string())?
    } else {
        conn.prepare(
            "SELECT id, order_id, peer, income_type, amount, order_time, status, import_batch
             FROM income_records WHERE peer = ?1 ORDER BY order_time DESC",
        )
        .map_err(|e| e.to_string())?
    };
    let map_row = |row: &rusqlite::Row| -> rusqlite::Result<IncomeRecord> {
        Ok(IncomeRecord {
            id: row.get(0)?,
            order_id: row.get(1)?,
            peer: row.get::<_, String>(2).unwrap_or_default(),
            income_type: row.get::<_, String>(3).unwrap_or_default(),
            amount: row.get(4)?,
            order_time: row.get::<_, String>(5).unwrap_or_default(),
            status: row.get::<_, String>(6).unwrap_or_default(),
            import_batch: row.get::<_, String>(7).unwrap_or_default(),
        })
    };
    let rows = (if is_unknown {
        stmt.query_map([], map_row)
    } else {
        stmt.query_map(params![peer], map_row)
    })
    .map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())?;
    Ok(rows)
}

// ── 应用入口 ──────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Android 上 reqwest/rustls 需要显式安装 crypto provider，否则启动即崩溃
    // ring 是纯 Rust 实现，Android 各架构 (x86_64/arm64) 无需 C 编译器
    // 桌面端即使已安装也会被 let _ = 安全忽略（重复安装返回 Err）
    // 参见：https://docs.rs/rustls/latest/rustls/#cryptography-providers
    let _ = rustls::crypto::ring::default_provider().install_default();

    tauri::Builder::default()
        .plugin(
            tauri::plugin::Builder::<tauri::Wry, ()>::new("backup")
                .setup(|app, api| {
                    #[cfg(target_os = "android")]
                    {
                        let handle = api
                            .register_android_plugin(
                                "com.bunnychen.dailycostvault",
                                "BackupPlugin",
                            )?;
                        app.manage(BackupAndroid(handle));
                    }
                    #[cfg(not(target_os = "android"))]
                    {
                        let _ = (app, api);
                    }
                    Ok(())
                })
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data dir");

            fs::create_dir_all(&app_data_dir).expect("Failed to create app data dir");

            let db_path = get_db_path(app_data_dir);
            println!("Database path: {:?}", db_path);

            let conn = Connection::open(&db_path).expect("Failed to open database");
            conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")
                .expect("Failed to set pragmas");

            init_db(&conn).expect("Failed to initialize database");

            app.manage(DbState {
                db: Mutex::new(conn),
                db_path: db_path.clone(),
            });

            // ── 拖拽导入监听 ──
            let window = app.get_webview_window("main").expect("no main window");
            let app_handle = app.handle().clone();

            window.on_window_event(move |event| {
                use tauri::WindowEvent;
                if let WindowEvent::DragDrop(drop_event) = event {
                    match drop_event {
                        tauri::DragDropEvent::Drop { paths, .. } => {
                            let csv_paths: Vec<String> = paths
                                .iter()
                                .filter(|p| p.extension().map(|e| e == "csv").unwrap_or(false))
                                .map(|p| p.to_string_lossy().to_string())
                                .collect();

                            if csv_paths.is_empty() {
                                let _ = app_handle.emit("import-done", ImportResult {
                                    success: false,
                                    imported: 0,
                                    skipped: 0,
                                    message: "未检测到 CSV 文件，请拖入 CSV 格式的订单文件".into(),
                                });
                                return;
                            }

                            let state = app_handle.state::<DbState>();
                            let conn = state.db.lock().unwrap();
                            let result = batch_import_csv(&csv_paths, &conn);
                            drop(conn);

                            let payload = result.unwrap_or_else(|e| ImportResult {
                                success: false,
                                imported: 0,
                                skipped: 0,
                                message: e,
                            });
                            let _ = app_handle.emit("import-done", payload);
                        }
                        _ => {}
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            import_csv,
            import_multiple_csv,
            import_csv_content,
            import_xlsx_content,
            export_database,
            export_database_to_uri,
            import_database,
            import_database_bytes,
            import_example_data,
            get_database_path,
            save_setting,
            get_setting,
            get_all_settings,
            add_item,
            update_item,
            delete_item,
            archive_item,
            restore_item,
            get_archived_items,
            get_archived_count,
            batch_restore_items,
            batch_delete_items,
            batch_archive_items,
            recalculate_categories,
            get_items,
            clear_all_data,
            get_import_batches,
            updater_is_supported,
            get_wechat_analytics,
            get_income_records_by_peer,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

