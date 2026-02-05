CREATE TABLE IF NOT EXISTS {{.prefix}}user_notifications (
    id VARCHAR(36) NOT NULL,
    target_user_id VARCHAR(36) NOT NULL,
    actor_user_id VARCHAR(36) NOT NULL,
    actor_name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    card_id VARCHAR(36) NOT NULL,
    card_title VARCHAR(255) NOT NULL DEFAULT '',
    board_id VARCHAR(36) NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    create_at BIGINT NOT NULL,
    update_at BIGINT NOT NULL,
    PRIMARY KEY (id)
);

CREATE INDEX idx_user_notifications_target_user ON {{.prefix}}user_notifications(target_user_id);
CREATE INDEX idx_user_notifications_create_at ON {{.prefix}}user_notifications(create_at);
