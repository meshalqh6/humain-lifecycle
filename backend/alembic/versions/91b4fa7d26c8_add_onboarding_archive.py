"""Hide archived onboarding cards without deleting operational evidence."""
from alembic import op
import sqlalchemy as sa

revision = "91b4fa7d26c8"
down_revision = "7a3c901de245"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("onboarding_workflows", sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True))


def downgrade():
    op.drop_column("onboarding_workflows", "archived_at")
