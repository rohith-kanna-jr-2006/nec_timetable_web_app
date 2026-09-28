import React from 'react';
import PageHeader from '../../components/common/PageHeader';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import EmptyState from '../../components/common/EmptyState';
import Breadcrumbs from '../../components/layout/Breadcrumbs';

export default function RoutePlaceholder({
  title = 'Module View',
  section = 'Portal',
  phaseTarget = 'Phase 3-5',
  description = 'This module route is registered and its desktop layout shell is active.',
}) {
  return (
    <div>
      <PageHeader
        title={title}
        description={description}
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: section },
              { label: title },
            ]}
          />
        }
        badge={<Badge variant="neutral">{phaseTarget}</Badge>}
      />

      <Card>
        <EmptyState
          icon="🚧"
          title={`${title} Ready for Implementation`}
          description={`The desktop layout, sidebar routing, design tokens, and API client foundation for ${title} are verified in Phase 1. Complete business logic and live backend integration will be wired in ${phaseTarget}.`}
          action={
            <Badge variant="secondary" dot>
              Phase 1 Route Verified
            </Badge>
          }
        />
      </Card>
    </div>
  );
}
