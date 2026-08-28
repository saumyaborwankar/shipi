import { MigrationInterface, QueryRunner } from 'typeorm';

export class GoogleAuth1787000000000 implements MigrationInterface {
  name = 'GoogleAuth1787000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "passwordHash" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "authProvider" text NOT NULL DEFAULT 'password'`,
    );
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "googleSub" text`);
    await queryRunner.query(
      `CREATE INDEX "IDX_users_google_sub" ON "users" ("googleSub")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_users_google_sub"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "googleSub"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "authProvider"`);
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "passwordHash" SET NOT NULL`,
    );
  }
}
