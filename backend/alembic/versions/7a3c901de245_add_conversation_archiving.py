"""Allow users to remove their own chats while preserving operational evidence."""

from alembic import op
import sqlalchemy as sa

revision = "7a3c901de245"
down_revision = "5dd768d6fe7e"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("agent_conversations", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))


def downgrade():
    op.drop_column("agent_conversations", "deleted_at")
