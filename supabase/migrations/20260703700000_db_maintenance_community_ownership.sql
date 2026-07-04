-- ============================================================
-- DB MAINTENANCE: Delete OMEGA/Omega communities + Transfer Ownership
-- Timestamp: 20260703700000
-- ============================================================

DO $$
DECLARE
    v_admin_user_id   UUID;
    v_omega_ids       UUID[];
    v_transfer_ids    UUID[];
    v_community_id    UUID;
    v_community_name  TEXT;
    v_deleted_members INT;
    v_deleted_channels INT;
    v_deleted_channel_msgs INT;
    v_deleted_pinned  INT;
    v_deleted_posts   INT;
    v_deleted_comms   INT;
    v_transferred     INT;
BEGIN

    -- --------------------------------------------------------
    -- STEP 1: Identify the admin user (owner of this platform)
    -- --------------------------------------------------------
    SELECT id INTO v_admin_user_id
    FROM public.user_profiles
    WHERE is_admin = true
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_admin_user_id IS NULL THEN
        -- Fallback: use the earliest registered user
        SELECT id INTO v_admin_user_id
        FROM public.user_profiles
        ORDER BY created_at ASC
        LIMIT 1;
    END IF;

    IF v_admin_user_id IS NULL THEN
        RAISE EXCEPTION 'No user found in user_profiles. Cannot proceed with maintenance.';
    END IF;

    RAISE NOTICE '=== DB MAINTENANCE STARTED ===';
    RAISE NOTICE 'Admin user ID: %', v_admin_user_id;

    -- --------------------------------------------------------
    -- STEP 2: Collect IDs for communities to DELETE
    --         (case-sensitive match: "OMEGA" and "Omega")
    -- --------------------------------------------------------
    SELECT ARRAY_AGG(id) INTO v_omega_ids
    FROM public.communities
    WHERE name IN ('OMEGA', 'Omega');

    IF v_omega_ids IS NULL OR array_length(v_omega_ids, 1) = 0 THEN
        RAISE NOTICE 'No communities named OMEGA or Omega found. Skipping deletion step.';
    ELSE
        RAISE NOTICE 'Communities to DELETE: %', v_omega_ids;

        -- 2a. Delete channel messages for channels in these communities
        DELETE FROM public.channel_messages
        WHERE channel_id IN (
            SELECT id FROM public.community_channels
            WHERE community_id = ANY(v_omega_ids)
        );
        GET DIAGNOSTICS v_deleted_channel_msgs = ROW_COUNT;
        RAISE NOTICE 'Deleted % channel_messages', v_deleted_channel_msgs;

        -- 2b. Delete community channels
        DELETE FROM public.community_channels
        WHERE community_id = ANY(v_omega_ids);
        GET DIAGNOSTICS v_deleted_channels = ROW_COUNT;
        RAISE NOTICE 'Deleted % community_channels', v_deleted_channels;

        -- 2c. Delete pinned_posts linked to these communities
        DELETE FROM public.pinned_posts
        WHERE community_id = ANY(v_omega_ids);
        GET DIAGNOSTICS v_deleted_pinned = ROW_COUNT;
        RAISE NOTICE 'Deleted % pinned_posts', v_deleted_pinned;

        -- 2d. Nullify community_id on posts (preserve posts, unlink from community)
        UPDATE public.posts
        SET community_id = NULL
        WHERE community_id = ANY(v_omega_ids);
        GET DIAGNOSTICS v_deleted_posts = ROW_COUNT;
        RAISE NOTICE 'Unlinked % posts from deleted communities', v_deleted_posts;

        -- 2e. Delete community memberships
        DELETE FROM public.community_members
        WHERE community_id = ANY(v_omega_ids);
        GET DIAGNOSTICS v_deleted_members = ROW_COUNT;
        RAISE NOTICE 'Deleted % community_members', v_deleted_members;

        -- 2f. Delete the communities themselves
        DELETE FROM public.communities
        WHERE id = ANY(v_omega_ids);
        GET DIAGNOSTICS v_deleted_comms = ROW_COUNT;
        RAISE NOTICE 'Deleted % communities (OMEGA / Omega)', v_deleted_comms;
    END IF;

    -- --------------------------------------------------------
    -- STEP 3: Collect IDs for communities to TRANSFER OWNERSHIP
    -- --------------------------------------------------------
    SELECT ARRAY_AGG(id) INTO v_transfer_ids
    FROM public.communities
    WHERE name IN ('HUMAN SYSTEM', '144.000', 'CHOSEN ONES', 'GREK BROTHERHOOD', 'FREEMASONS');

    IF v_transfer_ids IS NULL OR array_length(v_transfer_ids, 1) = 0 THEN
        RAISE NOTICE 'No target communities found for ownership transfer. Check community names.';
    ELSE
        RAISE NOTICE 'Communities to TRANSFER: %', v_transfer_ids;

        -- 3a. Update owner_id on communities table
        UPDATE public.communities
        SET owner_id   = v_admin_user_id,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ANY(v_transfer_ids);
        GET DIAGNOSTICS v_transferred = ROW_COUNT;
        RAISE NOTICE 'Updated owner_id on % communities', v_transferred;

        -- 3b. For each community, upsert the admin user as 'owner' in community_members
        FOREACH v_community_id IN ARRAY v_transfer_ids LOOP

            SELECT name INTO v_community_name
            FROM public.communities
            WHERE id = v_community_id;

            -- Remove any existing membership rows for this user in this community
            -- (avoids duplicate-key issues before re-inserting with correct role)
            DELETE FROM public.community_members
            WHERE community_id = v_community_id
              AND user_id = v_admin_user_id;

            -- Insert fresh owner + admin membership record
            INSERT INTO public.community_members (id, community_id, user_id, role, joined_at)
            VALUES (gen_random_uuid(), v_community_id, v_admin_user_id, 'owner', CURRENT_TIMESTAMP);

            RAISE NOTICE 'Ownership transferred for community: % (%)', v_community_name, v_community_id;
        END LOOP;

        -- 3c. Ensure no duplicate 'owner' rows remain for other users in these communities
        --     (demote any previous owner-role members who are NOT the new admin)
        UPDATE public.community_members
        SET role = 'admin'
        WHERE community_id = ANY(v_transfer_ids)
          AND user_id <> v_admin_user_id
          AND role = 'owner';

        RAISE NOTICE 'Demoted previous owner-role members to admin where applicable.';
    END IF;

    -- --------------------------------------------------------
    -- STEP 4: Verification summary
    -- --------------------------------------------------------
    RAISE NOTICE '';
    RAISE NOTICE '=== VERIFICATION SUMMARY ===';

    -- Confirm OMEGA/Omega are gone
    IF NOT EXISTS (SELECT 1 FROM public.communities WHERE name IN ('OMEGA', 'Omega')) THEN
        RAISE NOTICE '[OK] Communities OMEGA and Omega have been permanently deleted.';
    ELSE
        RAISE NOTICE '[WARN] One or more OMEGA/Omega communities still exist!';
    END IF;

    -- Confirm ownership transfers
    FOR v_community_id, v_community_name IN
        SELECT c.id, c.name
        FROM public.communities c
        WHERE c.name IN ('HUMAN SYSTEM', '144.000', 'CHOSEN ONES', 'GREK BROTHERHOOD', 'FREEMASONS')
    LOOP
        IF EXISTS (
            SELECT 1 FROM public.community_members
            WHERE community_id = v_community_id
              AND user_id = v_admin_user_id
              AND role = 'owner'
        ) AND (
            SELECT owner_id FROM public.communities WHERE id = v_community_id
        ) = v_admin_user_id THEN
            RAISE NOTICE '[OK] % — owner_id and community_members.role=owner confirmed for admin user.', v_community_name;
        ELSE
            RAISE NOTICE '[WARN] % — ownership transfer may be incomplete!', v_community_name;
        END IF;
    END LOOP;

    RAISE NOTICE '=== DB MAINTENANCE COMPLETE ===';

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'DB Maintenance failed: % — SQLSTATE: %', SQLERRM, SQLSTATE;
END $$;
