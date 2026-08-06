import { MigrationInterface, QueryRunner } from "typeorm";

export class InitTables1786026382578 implements MigrationInterface {
    name = 'InitTables1786026382578'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" text NOT NULL, "passwordHash" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "vaults" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "ownerId" uuid NOT NULL, "name" text NOT NULL, "keyFingerprint" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_487a5346fa3693a430b6d6db60c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "files" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "vaultId" uuid NOT NULL, "path" text NOT NULL, "currentVersionNo" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_files_vault_path" UNIQUE ("vaultId", "path"), CONSTRAINT "PK_6c16b9093a142e0e7613b04a3d9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "file_versions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "fileId" uuid NOT NULL, "versionNo" integer NOT NULL, "blob" bytea NOT NULL, "iv" text NOT NULL, "authTag" text NOT NULL, "byteLength" integer NOT NULL, "sha256" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_file_versions_file_version" UNIQUE ("fileId", "versionNo"), CONSTRAINT "PK_caca394bb05012a3d17c1d8b336" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "vaults" ADD CONSTRAINT "FK_2595182ac08342bf379e1b68657" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "files" ADD CONSTRAINT "FK_6cdef7e8bcc75c74889a3c91d1e" FOREIGN KEY ("vaultId") REFERENCES "vaults"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "file_versions" ADD CONSTRAINT "FK_5b2975bbaeb5c5db8c57ac438f4" FOREIGN KEY ("fileId") REFERENCES "files"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "file_versions" DROP CONSTRAINT "FK_5b2975bbaeb5c5db8c57ac438f4"`);
        await queryRunner.query(`ALTER TABLE "files" DROP CONSTRAINT "FK_6cdef7e8bcc75c74889a3c91d1e"`);
        await queryRunner.query(`ALTER TABLE "vaults" DROP CONSTRAINT "FK_2595182ac08342bf379e1b68657"`);
        await queryRunner.query(`DROP TABLE "file_versions"`);
        await queryRunner.query(`DROP TABLE "files"`);
        await queryRunner.query(`DROP TABLE "vaults"`);
        await queryRunner.query(`DROP TABLE "users"`);
    }

}
