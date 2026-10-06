import { auth, isAdminEmail } from "@/auth";
import { Materials } from "@/components/materiais/materials";
import { areaOptions } from "@/lib/area-tree";
import { getTree } from "@/server/queries";
import { getMaterials, storageUsed } from "@/server/materiais";
import { QUOTA_BYTES, r2MissingVars, UPLOAD_MAX_BYTES } from "@/server/r2";

export default async function MateriaisPage() {
  const session = (await auth())!;
  const userId = session.user!.id!;
  const [items, used, tree] = await Promise.all([getMaterials(userId), storageUsed(userId), getTree(userId)]);
  const missing = r2MissingVars();
  return (
    <Materials
      items={items}
      tree={areaOptions(tree)}
      storage={{ enabled: !missing.length, used, quota: QUOTA_BYTES, maxFile: UPLOAD_MAX_BYTES }}
      missingVars={isAdminEmail(session.user?.email) ? missing : []}
    />
  );
}
