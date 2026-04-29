export async function ensureFeatureColumns(sequelize) {
  await sequelize.query(
    'ALTER TABLE "thread" ADD COLUMN IF NOT EXISTS comments_disabled BOOLEAN NOT NULL DEFAULT false'
  );
  await sequelize.query(
    "ALTER TABLE thread_comment ADD COLUMN IF NOT EXISTS parent_comment_id UUID NULL"
  );
  await sequelize.query(
    "ALTER TABLE thread_comment ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false"
  );
  await sequelize.query(
    "ALTER TABLE thread_comment ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()"
  );
  await sequelize.query(
    "CREATE INDEX IF NOT EXISTS idx_thread_comment_parent_comment_id ON thread_comment(parent_comment_id)"
  );
  await sequelize.query(
    "CREATE INDEX IF NOT EXISTS idx_scams_source_scan_id ON scams(source_scan_id)"
  );
  await sequelize.query(
    "ALTER TABLE settings ADD COLUMN IF NOT EXISTS is_2fa_enabled BOOLEAN NOT NULL DEFAULT false"
  );
  await sequelize.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'settings_settings_id_fkey'
          AND conrelid = 'settings'::regclass
      ) THEN
        ALTER TABLE settings DROP CONSTRAINT settings_settings_id_fkey;
      END IF;
    END $$;
  `);
  await sequelize.query(
    "ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_user_id_fkey"
  );
  await sequelize.query(
    "ALTER TABLE settings ADD CONSTRAINT settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE NOT VALID"
  );
  await sequelize.query(
    "CREATE INDEX IF NOT EXISTS idx_settings_user_id ON settings(user_id)"
  );
  await sequelize.query(
    "ALTER TABLE otp_login ADD COLUMN IF NOT EXISTS used BOOLEAN NOT NULL DEFAULT false"
  );
}
