export type StandardPermissionAction = "view" | "create" | "edit" | "delete";
export type ExtendedPermissionAction =
  | "import"
  | "export"
  | "new_membership"
  | "overdue_payment"
  | "cancel_membership";
export type PermissionAction = StandardPermissionAction | ExtendedPermissionAction;

const STANDARD_ACTIONS: readonly StandardPermissionAction[] = ["view", "create", "edit", "delete"];

export type ModuleKey =
  | "dashboard"
  | "membership_plans"
  | "packages"
  | "member_management"
  | "subscription_management"
  | "transactions"
  | "expenses"
  | "staff_management"
  | "branch_management"
  | "settings"
  | "gym_profile"
  | "subscription_pricing"
  | "rbac_settings"
  | "user_management";

export type ModuleSection =
  | "dashboard"
  | "master"
  | "operations"
  | "branches"
  | "expenses"
  | "staff"
  | "settings"
  | "admin_only";

export type ModulePermission = Partial<Record<PermissionAction, boolean>>;

export type RolePermissionMap = Partial<Record<ModuleKey, ModulePermission>>;

export type ModuleRegistryEntry = {
  key: ModuleKey;
  label: string;
  section: ModuleSection;
  actions: readonly PermissionAction[];
  hiddenInRoleMaster?: boolean;
  aliasesTo?: ModuleKey;
};

export const MODULE_REGISTRY: readonly ModuleRegistryEntry[] = [
  { key: "dashboard", label: "Dashboard", section: "dashboard", actions: ["view"] },
  {
    key: "membership_plans",
    label: "Membership Plans",
    section: "master",
    actions: ["view", "create", "edit", "delete"]
  },
  { key: "packages", label: "Packages", section: "master", actions: ["view"], hiddenInRoleMaster: true },
  {
    key: "member_management",
    label: "Members",
    section: "operations",
    actions: [
      "view",
      "create",
      "edit",
      "delete",
      "import",
      "new_membership",
      "overdue_payment",
      "cancel_membership",
      "export"
    ]
  },
  {
    key: "subscription_management",
    label: "Member subscriptions",
    section: "operations",
    actions: [
      "view",
      "create",
      "edit",
      "delete",
      "import",
      "new_membership",
      "overdue_payment",
      "cancel_membership",
      "export"
    ],
    hiddenInRoleMaster: true,
    aliasesTo: "member_management"
  },
  {
    key: "transactions",
    label: "Transactions",
    section: "operations",
    actions: ["view", "export"]
  },
  {
    key: "expenses",
    label: "Expenses",
    section: "expenses",
    actions: ["view", "create", "edit", "delete", "export"]
  },
  {
    key: "staff_management",
    label: "Staff / Manager",
    section: "staff",
    actions: ["view", "create", "edit", "delete", "export"]
  },
  {
    key: "branch_management",
    label: "Branch Management",
    section: "branches",
    actions: ["view", "create", "edit", "delete", "export"]
  },
  { key: "settings", label: "Profile Settings", section: "settings", actions: ["view"] },
  { key: "gym_profile", label: "Gym Settings", section: "settings", actions: ["view"] },
  {
    key: "subscription_pricing",
    label: "Subscription & Pricing",
    section: "settings",
    actions: ["view"]
  },
  { key: "rbac_settings", label: "Role Master", section: "admin_only", actions: ["view"] },
  {
    key: "user_management",
    label: "User Management",
    section: "admin_only",
    actions: ["view"],
    hiddenInRoleMaster: true
  }
] as const;

export const HIDDEN_MODULES = MODULE_REGISTRY.filter((entry) => entry.hiddenInRoleMaster).map(
  (entry) => entry.key
);

export const ADMIN_ONLY_MODULES: ModuleKey[] = ["user_management", "rbac_settings"];

export const MANAGER_ALLOWED_ADMIN_MODULES: ModuleKey[] = ["rbac_settings"];

const MODULE_BY_KEY = new Map(MODULE_REGISTRY.map((entry) => [entry.key, entry]));

const LEGACY_FLAT_ALIASES: Record<string, ModuleKey> = {
  financial_overview: "dashboard"
};

const MEMBER_COUPLED_MODULES: ModuleKey[] = ["member_management", "subscription_management"];

const RETIRED_FLAT_KEYS = new Set(["attendance", "billing_dashboard"]);

function resolveModuleForCheck(module: string): ModuleKey | null {
  const entry = MODULE_BY_KEY.get(module as ModuleKey);
  if (entry?.aliasesTo) {
    return entry.aliasesTo;
  }
  if (MODULE_BY_KEY.has(module as ModuleKey)) {
    return module as ModuleKey;
  }
  return null;
}

export function emptyRolePermissions(): RolePermissionMap {
  return {};
}

export function isModuleKey(value: unknown): value is ModuleKey {
  return typeof value === "string" && MODULE_BY_KEY.has(value as ModuleKey);
}

export function isPermissionAction(value: unknown): value is PermissionAction {
  if (typeof value !== "string") {
    return false;
  }
  return MODULE_REGISTRY.some((entry) => entry.actions.includes(value as PermissionAction));
}

function grantStandardActionsFromFlat(entry: ModuleRegistryEntry, map: RolePermissionMap) {
  for (const action of entry.actions) {
    if ((STANDARD_ACTIONS as readonly string[]).includes(action)) {
      setAction(map, entry.key, action, true);
    }
  }
}

/** One-time additive upgrade for gyms stored on RBAC schema v3. */
export function upgradePermissionsV4(map: RolePermissionMap): RolePermissionMap {
  const next: RolePermissionMap = { ...map };

  const members = next.member_management;
  if (members) {
    const upgraded = { ...members };
    if (members.create) {
      upgraded.import = true;
      upgraded.new_membership = true;
    }
    if (members.edit) {
      upgraded.overdue_payment = true;
      upgraded.cancel_membership = true;
    }
    if (members.view) {
      upgraded.export = true;
    }
    next.member_management = upgraded;
  }

  const branches = next.branch_management;
  if (branches?.view) {
    next.branch_management = {
      ...branches,
      create: true,
      edit: true,
      delete: true,
      export: true
    };
  }

  const expenses = next.expenses;
  if (expenses?.view) {
    next.expenses = { ...expenses, export: true };
  }

  const staff = next.staff_management;
  if (staff?.view) {
    next.staff_management = { ...staff, export: true };
  }

  return applyModuleDependencies(next);
}

/** Split legacy settings access into subscription & pricing module (schema v5). */
export function upgradePermissionsV5(map: RolePermissionMap): RolePermissionMap {
  const next: RolePermissionMap = { ...map };
  if (next.settings?.view) {
    next.subscription_pricing = { view: true };
  }
  return applyModuleDependencies(next);
}

/** Grant transactions access to roles that could view the transactions page (schema v6). */
export function upgradePermissionsV6(map: RolePermissionMap): RolePermissionMap {
  const next: RolePermissionMap = { ...map };
  const members = next.member_management;
  if (members?.view) {
    const existing = next.transactions ?? {};
    next.transactions = {
      view: true,
      export: existing.export === true || members.export === true
    };
  }
  return applyModuleDependencies(next);
}

function setAction(map: RolePermissionMap, module: ModuleKey, action: PermissionAction, enabled: boolean) {
  if (!enabled) {
    return;
  }
  const current = map[module] ?? {};
  map[module] = { ...current, [action]: true };
}

export function applyModuleDependencies(map: RolePermissionMap): RolePermissionMap {
  const next: RolePermissionMap = { ...map };

  const plans = next.membership_plans;
  if (plans?.view) {
    next.packages = { view: true };
  } else if (next.packages && Object.keys(next.packages).length === 1 && next.packages.view) {
    delete next.packages;
  }

  const members = next.member_management;
  if (members) {
    next.subscription_management = { ...members };
  } else {
    delete next.subscription_management;
  }

  return next;
}

export function sanitizeRolePermissions(
  role: "owner" | "manager" | "staff",
  input: RolePermissionMap
): RolePermissionMap {
  const cleaned: RolePermissionMap = {};

  for (const entry of MODULE_REGISTRY) {
    const source = input[entry.key];
    if (!source || typeof source !== "object") {
      continue;
    }
    const perm: ModulePermission = {};
    for (const action of entry.actions) {
      if (source[action] === true) {
        perm[action] = true;
      }
    }
    if (Object.keys(perm).length > 0) {
      cleaned[entry.key] = perm;
    }
  }

  let withDeps = applyModuleDependencies(cleaned);

  if (role === "manager") {
    const filtered: RolePermissionMap = {};
    for (const [key, value] of Object.entries(withDeps) as [ModuleKey, ModulePermission][]) {
      if (ADMIN_ONLY_MODULES.includes(key) && !MANAGER_ALLOWED_ADMIN_MODULES.includes(key)) {
        continue;
      }
      filtered[key] = value;
    }
    withDeps = filtered;
  } else if (role === "staff") {
    const filtered: RolePermissionMap = {};
    for (const [key, value] of Object.entries(withDeps) as [ModuleKey, ModulePermission][]) {
      if (!ADMIN_ONLY_MODULES.includes(key)) {
        filtered[key] = value;
      }
    }
    withDeps = filtered;
  }

  return withDeps;
}

export function hasModulePermission(
  permissions: RolePermissionMap,
  module: string,
  action: PermissionAction,
  role?: string
): boolean {
  if (String(role ?? "").toLowerCase() === "owner") {
    return true;
  }

  const resolved = resolveModuleForCheck(module);
  if (!resolved) {
    return false;
  }

  const entry = MODULE_BY_KEY.get(resolved);
  if (!entry?.actions.includes(action)) {
    return false;
  }

  if (permissions[resolved]?.[action] === true) {
    return true;
  }

  return false;
}

export function hasAnyModuleView(permissions: RolePermissionMap, modules: string[], role?: string): boolean {
  if (String(role ?? "").toLowerCase() === "owner") {
    return true;
  }
  return modules.some((module) => hasModulePermission(permissions, module, "view", role));
}

export type ModuleActionRequirement = { module: string; action: PermissionAction };

/** Read member payment lines (member profile → Transactions tab). */
export const MEMBER_PAYMENTS_READ_ACCESS: readonly ModuleActionRequirement[] = [
  { module: "member_management", action: "edit" },
  { module: "member_management", action: "view" },
  { module: "transactions", action: "view" }
];

export function hasAnyModuleAction(
  permissions: RolePermissionMap,
  requirements: readonly ModuleActionRequirement[],
  role?: string
): boolean {
  if (String(role ?? "").toLowerCase() === "owner") {
    return true;
  }
  return requirements.some(({ module, action }) => hasModulePermission(permissions, module, action, role));
}

export function canViewMemberPayments(permissions: RolePermissionMap, role?: string): boolean {
  return hasAnyModuleAction(permissions, MEMBER_PAYMENTS_READ_ACCESS, role);
}

function mergeMemberAndSubscriptionFromFlat(flat: Set<string>, map: RolePermissionMap) {
  const actions: StandardPermissionAction[] = [...STANDARD_ACTIONS];
  for (const action of actions) {
    const memberHas =
      (action === "view" && flat.has("member_management")) ||
      flat.has(`member_management_${action}`) ||
      flat.has("member_management_add");
    const subHas =
      (action === "view" && flat.has("subscription_management")) ||
      flat.has(`subscription_management_${action}`) ||
      flat.has("subscription_management_add");
    if (memberHas || subHas) {
      setAction(map, "member_management", action, true);
    }
  }
}

export function migrateFlatArraysToNested(flatKeys: string[]): RolePermissionMap {
  const flat = new Set<string>(
    flatKeys
      .map((k) => String(LEGACY_FLAT_ALIASES[k] ?? k))
      .filter((k) => k.length > 0 && !RETIRED_FLAT_KEYS.has(k))
  );

  const map: RolePermissionMap = {};
  mergeMemberAndSubscriptionFromFlat(flat, map);

  for (const entry of MODULE_REGISTRY) {
    if (MEMBER_COUPLED_MODULES.includes(entry.key)) {
      continue;
    }

    if (flat.has(entry.key)) {
      grantStandardActionsFromFlat(entry, map);
      continue;
    }

    for (const action of entry.actions) {
      if (action === "view") {
        continue;
      }
      const legacyAdd = `${entry.key}_add`;
      const legacyAction = `${entry.key}_${action}`;
      if (flat.has(legacyAction) || (action === "create" && flat.has(legacyAdd))) {
        setAction(map, entry.key, action, true);
        setAction(map, entry.key, "view", true);
      }
    }

    if (entry.actions.includes("view") && flat.has(entry.key)) {
      setAction(map, entry.key, "view", true);
    }
  }

  return upgradePermissionsV4(applyModuleDependencies(map));
}

export function normalizeRolePermissionMap(input: unknown): RolePermissionMap | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return null;
  }

  const map: RolePermissionMap = {};
  for (const [rawKey, rawPerm] of Object.entries(input as Record<string, unknown>)) {
    const moduleKey = (LEGACY_FLAT_ALIASES[rawKey] ?? rawKey) as ModuleKey;
    const entry = MODULE_BY_KEY.get(moduleKey);
    if (!entry || !rawPerm || typeof rawPerm !== "object" || Array.isArray(rawPerm)) {
      continue;
    }
    const perm: ModulePermission = {};
    for (const [rawAction, value] of Object.entries(rawPerm as Record<string, unknown>)) {
      const action = rawAction === "add" ? "create" : (rawAction as PermissionAction);
      if (entry.actions.includes(action) && value === true) {
        perm[action] = true;
      }
    }
    if (Object.keys(perm).length > 0) {
      map[moduleKey] = perm;
    }
  }

  return map;
}

/** Accept legacy session string[] or nested map. */
export function permissionsFromUnknown(input: unknown, role: string): RolePermissionMap {
  if (String(role).toLowerCase() === "owner") {
    return {};
  }
  if (Array.isArray(input)) {
    return migrateFlatArraysToNested(input.map(String));
  }
  const nested = normalizeRolePermissionMap(input);
  return nested ?? {};
}

export function ownerFullPermissions(): RolePermissionMap {
  const map: RolePermissionMap = {};
  for (const entry of MODULE_REGISTRY) {
    if (entry.hiddenInRoleMaster && entry.key !== "packages" && entry.key !== "subscription_management") {
      continue;
    }
    const perm: ModulePermission = {};
    for (const action of entry.actions) {
      perm[action] = true;
    }
    map[entry.key] = perm;
  }
  return applyModuleDependencies(map);
}

export function defaultManagerPermissions(): RolePermissionMap {
  return migrateFlatArraysToNested([
    "dashboard",
    "membership_plans",
    "packages",
    "member_management",
    "subscription_management"
  ]);
}

export function defaultStaffPermissions(): RolePermissionMap {
  return migrateFlatArraysToNested([
    "dashboard",
    "membership_plans",
    "packages",
    "member_management",
    "subscription_management"
  ]);
}

export function registryForRoleMaster(): ModuleRegistryEntry[] {
  return MODULE_REGISTRY.filter((entry) => !entry.hiddenInRoleMaster);
}

export function registryBySection(): Map<ModuleSection, ModuleRegistryEntry[]> {
  const map = new Map<ModuleSection, ModuleRegistryEntry[]>();
  for (const entry of registryForRoleMaster()) {
    const list = map.get(entry.section) ?? [];
    map.set(entry.section, [...list, entry]);
  }
  return map;
}
