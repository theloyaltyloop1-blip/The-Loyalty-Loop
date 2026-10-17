type Storage = {
  from(bucket: string): {
    list(prefix: string, options: { limit: number; offset: number; sortBy: { column: string; order: string } }): PromiseLike<{ data: { id: string | null; name: string }[] | null; error: unknown }>;
    remove(paths: string[]): PromiseLike<{ error: unknown }>;
  };
};

// Collect every page before removing anything so offsets cannot skip files.
export async function listTree(storage: Storage, bucket: string, prefix: string): Promise<string[]> {
  const paths: string[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await storage.from(bucket).list(prefix, { limit: 100, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw error;
    for (const item of data ?? []) {
      const path = `${prefix}/${item.name}`;
      if (item.id === null) paths.push(...await listTree(storage, bucket, path));
      else paths.push(path);
    }
    if ((data ?? []).length < 100) return paths;
  }
}

export async function removeFiles(storage: Storage, files: Record<string, string[]>): Promise<string[]> {
  const leftovers: string[] = [];
  for (const [bucket, paths] of Object.entries(files)) {
    for (let offset = 0; offset < paths.length; offset += 100) {
      const batch = paths.slice(offset, offset + 100);
      try {
        const { error } = await storage.from(bucket).remove(batch);
        if (error) throw error;
      } catch {
        leftovers.push(...batch.map(path => `${bucket}/${path}`));
      }
    }
  }
  return leftovers;
}

// Authorization is checked by the handler and again inside deleteShop's RPC.
export async function deleteShopAndFiles(storage: Storage, businessId: string, documentPath: string | null, deleteShop: () => Promise<void>) {
  const files: Record<string, string[]> = {};
  for (const bucket of ["logos", "covers", "gallery"]) files[bucket] = await listTree(storage, bucket, businessId);
  if (documentPath) files.owner_verification_docs = [documentPath];
  await deleteShop();
  return removeFiles(storage, files);
}
