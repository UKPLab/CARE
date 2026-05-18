'use strict';

/**
 * DB-only encryption for selected user fields while keeping the app contract stable.
 * The app continues to read/write table name "user" and the same column names.
 */
module.exports = {
    async up(queryInterface) {
        const encryptionKey = process.env.DB_ENCRYPTION_KEY;
        if (!encryptionKey) {
            throw new Error('DB_ENCRYPTION_KEY must be set before running user encryption migration');
        }

        await queryInterface.sequelize.transaction(async (transaction) => {
            await queryInterface.sequelize.query(
                `SELECT set_config('app.encryption_key', :encryptionKey, false);`,
                {
                    replacements: { encryptionKey },
                    transaction,
                }
            );

            await queryInterface.sequelize.query(
                `CREATE EXTENSION IF NOT EXISTS pgcrypto;`,
                { transaction }
            );

            await queryInterface.sequelize.query(
                `
                CREATE OR REPLACE FUNCTION public.encrypt_text(p_value text)
                RETURNS bytea
                LANGUAGE plpgsql
                AS $$
                DECLARE
                    v_key text;
                BEGIN
                    IF p_value IS NULL THEN
                        RETURN NULL;
                    END IF;

                    v_key := current_setting('app.encryption_key', true);
                    IF v_key IS NULL OR v_key = '' THEN
                        RAISE EXCEPTION 'app.encryption_key is not set';
                    END IF;

                    RETURN pgp_sym_encrypt(p_value, v_key);
                END;
                $$;
                `,
                { transaction }
            );

            await queryInterface.sequelize.query(
                `
                CREATE OR REPLACE FUNCTION public.decrypt_text(p_value bytea)
                RETURNS text
                LANGUAGE plpgsql
                AS $$
                DECLARE
                    v_key text;
                BEGIN
                    IF p_value IS NULL THEN
                        RETURN NULL;
                    END IF;

                    v_key := current_setting('app.encryption_key', true);
                    IF v_key IS NULL OR v_key = '' THEN
                        RAISE EXCEPTION 'app.encryption_key is not set';
                    END IF;

                    RETURN pgp_sym_decrypt(p_value, v_key);
                END;
                $$;
                `,
                { transaction }
            );

            await queryInterface.sequelize.query(
                `ALTER TABLE public."user" RENAME TO user_secure;`,
                { transaction }
            );

            await queryInterface.sequelize.query(
                `
                ALTER TABLE public.user_secure
                    ALTER COLUMN "firstName" TYPE bytea USING public.encrypt_text("firstName"),
                    ALTER COLUMN "lastName" TYPE bytea USING public.encrypt_text("lastName"),
                    ALTER COLUMN email TYPE bytea USING public.encrypt_text(email),
                    ALTER COLUMN "initialPassword" TYPE bytea USING public.encrypt_text("initialPassword");
                `,
                { transaction }
            );

            await queryInterface.sequelize.query(
                `
                CREATE OR REPLACE VIEW public."user" AS
                SELECT
                    id,
                    public.decrypt_text("firstName") AS "firstName",
                    public.decrypt_text("lastName") AS "lastName",
                    "userName",
                    public.decrypt_text(email) AS email,
                    "passwordHash",
                    "acceptTerms",
                    "acceptStats",
                    salt,
                    "lastLoginAt",
                    deleted,
                    "createdAt",
                    "updatedAt",
                    "deletedAt",
                    "acceptedAt",
                    "acceptDataSharing",
                    "rolesUpdatedAt",
                    "extId",
                    public.decrypt_text("initialPassword") AS "initialPassword",
                    "emailVerified",
                    "emailVerificationToken",
                    "resetToken",
                    "lastPasswordResetEmailSent",
                    "lastVerificationEmailSent",
                    "twoFactorOtp",
                    "twoFactorOtpExpiresAt",
                    "twoFactorMethods",
                    "totpSecret",
                    "orcidId",
                    "ldapUsername",
                    "samlNameId"
                FROM public.user_secure;
                `,
                { transaction }
            );

            await queryInterface.sequelize.query(
                `
                CREATE OR REPLACE FUNCTION public.user_view_iud()
                RETURNS trigger
                LANGUAGE plpgsql
                AS $$
                DECLARE
                    v_id integer;
                BEGIN
                    IF TG_OP = 'INSERT' THEN
                        IF EXISTS (
                            SELECT 1
                            FROM public.user_secure u
                            WHERE public.decrypt_text(u.email) = NEW.email
                        ) THEN
                            RAISE unique_violation USING MESSAGE = 'duplicate key value violates unique constraint "user_email_key"';
                        END IF;

                        INSERT INTO public.user_secure (
                            id, "firstName", "lastName", "userName", email,
                            "passwordHash", "acceptTerms", "acceptStats", salt, "lastLoginAt",
                            deleted, "createdAt", "updatedAt", "deletedAt", "acceptedAt",
                            "acceptDataSharing", "rolesUpdatedAt", "extId", "initialPassword",
                            "emailVerified", "emailVerificationToken", "resetToken",
                            "lastPasswordResetEmailSent", "lastVerificationEmailSent",
                            "twoFactorOtp", "twoFactorOtpExpiresAt", "twoFactorMethods",
                            "totpSecret", "orcidId", "ldapUsername", "samlNameId"
                        )
                        VALUES (
                            COALESCE(NEW.id, nextval(pg_get_serial_sequence('public.user_secure', 'id'))),
                            public.encrypt_text(NEW."firstName"),
                            public.encrypt_text(NEW."lastName"),
                            NEW."userName",
                            public.encrypt_text(NEW.email),
                            NEW."passwordHash",
                            NEW."acceptTerms",
                            NEW."acceptStats",
                            NEW.salt,
                            NEW."lastLoginAt",
                            NEW.deleted,
                            NEW."createdAt",
                            NEW."updatedAt",
                            NEW."deletedAt",
                            NEW."acceptedAt",
                            NEW."acceptDataSharing",
                            NEW."rolesUpdatedAt",
                            NEW."extId",
                            public.encrypt_text(NEW."initialPassword"),
                            NEW."emailVerified",
                            NEW."emailVerificationToken",
                            NEW."resetToken",
                            NEW."lastPasswordResetEmailSent",
                            NEW."lastVerificationEmailSent",
                            NEW."twoFactorOtp",
                            NEW."twoFactorOtpExpiresAt",
                            NEW."twoFactorMethods",
                            NEW."totpSecret",
                            NEW."orcidId",
                            NEW."ldapUsername",
                            NEW."samlNameId"
                        )
                        RETURNING id INTO v_id;

                        NEW.id := v_id;
                        RETURN NEW;
                    END IF;

                    IF TG_OP = 'UPDATE' THEN
                        IF EXISTS (
                            SELECT 1
                            FROM public.user_secure u
                            WHERE u.id <> OLD.id
                              AND public.decrypt_text(u.email) = NEW.email
                        ) THEN
                            RAISE unique_violation USING MESSAGE = 'duplicate key value violates unique constraint "user_email_key"';
                        END IF;

                        UPDATE public.user_secure
                        SET
                            "firstName" = public.encrypt_text(NEW."firstName"),
                            "lastName" = public.encrypt_text(NEW."lastName"),
                            "userName" = NEW."userName",
                            email = public.encrypt_text(NEW.email),
                            "passwordHash" = NEW."passwordHash",
                            "acceptTerms" = NEW."acceptTerms",
                            "acceptStats" = NEW."acceptStats",
                            salt = NEW.salt,
                            "lastLoginAt" = NEW."lastLoginAt",
                            deleted = NEW.deleted,
                            "createdAt" = NEW."createdAt",
                            "updatedAt" = NEW."updatedAt",
                            "deletedAt" = NEW."deletedAt",
                            "acceptedAt" = NEW."acceptedAt",
                            "acceptDataSharing" = NEW."acceptDataSharing",
                            "rolesUpdatedAt" = NEW."rolesUpdatedAt",
                            "extId" = NEW."extId",
                            "initialPassword" = public.encrypt_text(NEW."initialPassword"),
                            "emailVerified" = NEW."emailVerified",
                            "emailVerificationToken" = NEW."emailVerificationToken",
                            "resetToken" = NEW."resetToken",
                            "lastPasswordResetEmailSent" = NEW."lastPasswordResetEmailSent",
                            "lastVerificationEmailSent" = NEW."lastVerificationEmailSent",
                            "twoFactorOtp" = NEW."twoFactorOtp",
                            "twoFactorOtpExpiresAt" = NEW."twoFactorOtpExpiresAt",
                            "twoFactorMethods" = NEW."twoFactorMethods",
                            "totpSecret" = NEW."totpSecret",
                            "orcidId" = NEW."orcidId",
                            "ldapUsername" = NEW."ldapUsername",
                            "samlNameId" = NEW."samlNameId"
                        WHERE id = OLD.id;

                        RETURN NEW;
                    END IF;

                    IF TG_OP = 'DELETE' THEN
                        DELETE FROM public.user_secure WHERE id = OLD.id;
                        RETURN OLD;
                    END IF;

                    RETURN NULL;
                END;
                $$;
                `,
                { transaction }
            );

            await queryInterface.sequelize.query(
                `
                CREATE TRIGGER user_view_iud_trigger
                INSTEAD OF INSERT OR UPDATE OR DELETE ON public."user"
                FOR EACH ROW
                EXECUTE FUNCTION public.user_view_iud();
                `,
                { transaction }
            );
        });
    },

    async down(queryInterface) {
        const encryptionKey = process.env.DB_ENCRYPTION_KEY;
        if (!encryptionKey) {
            throw new Error('DB_ENCRYPTION_KEY must be set before reverting user encryption migration');
        }

        await queryInterface.sequelize.transaction(async (transaction) => {
            await queryInterface.sequelize.query(
                `SELECT set_config('app.encryption_key', :encryptionKey, false);`,
                {
                    replacements: { encryptionKey },
                    transaction,
                }
            );

            await queryInterface.sequelize.query(
                `DROP TRIGGER IF EXISTS user_view_iud_trigger ON public."user";`,
                { transaction }
            );
            await queryInterface.sequelize.query(
                `DROP FUNCTION IF EXISTS public.user_view_iud();`,
                { transaction }
            );
            await queryInterface.sequelize.query(
                `DROP VIEW IF EXISTS public."user";`,
                { transaction }
            );

            await queryInterface.sequelize.query(
                `
                ALTER TABLE public.user_secure
                    ALTER COLUMN "firstName" TYPE text USING public.decrypt_text("firstName"),
                    ALTER COLUMN "lastName" TYPE text USING public.decrypt_text("lastName"),
                    ALTER COLUMN email TYPE text USING public.decrypt_text(email),
                    ALTER COLUMN "initialPassword" TYPE text USING public.decrypt_text("initialPassword");
                `,
                { transaction }
            );

            await queryInterface.sequelize.query(
                `ALTER TABLE public.user_secure RENAME TO "user";`,
                { transaction }
            );
        });
    }
};
